import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createWriteStream, mkdirSync } from "fs";
import { readFile, rename, rm } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_H5P_SIZE = 600 * 1024 * 1024;

function parseMultipart(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { tmpPath: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_H5P_SIZE } });
    const fields: Record<string, string> = {};
    let fileResult: { tmpPath: string; originalName: string; size: number } | null = null;
    let busboyDone = false, writeDone = false, hasFile = false;

    function tryResolve() {
      if (busboyDone && (writeDone || !hasFile)) resolve({ fields, file: fileResult });
    }

    bb.on("field", (name, value) => { fields[name] = value; });

    bb.on("file", (_, stream, info) => {
      hasFile = true;
      const { filename } = info;
      if (!filename.toLowerCase().endsWith(".h5p")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .h5p sont acceptés"));
      }

      const tmpId = createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 12);
      const tmpDir = path.join(UPLOAD_DIR, "tmp");
      mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `${tmpId}.h5p`);

      let size = 0;
      const ws = createWriteStream(tmpPath);
      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => reject(new Error("Fichier trop volumineux (max 600 Mo)")));
      stream.pipe(ws);
      ws.on("finish", () => { fileResult = { tmpPath, originalName: filename, size }; writeDone = true; tryResolve(); });
      ws.on("error", reject);
    });

    bb.on("finish", () => { busboyDone = true; tryResolve(); });
    bb.on("error", reject);
    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let tmpPath: string | null = null;
  try {
    const { fields, file } = await parseMultipart(req);
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    tmpPath = file.tmpPath;
    const title = fields.title?.trim();
    const duration = parseInt(fields.duration ?? "", 10);
    const hasQuiz = fields.hasQuiz === "on";
    const passingScore = hasQuiz ? Math.max(0, Math.min(100, parseInt(fields.passingScore ?? "70", 10))) : null;
    const force = fields.force === "true";
    const createdById = isAdmin ? (fields.createdById?.trim() || null) : session.user.id;

    if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });
    if (isNaN(duration) || duration < 1) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });

    // Calcul du hash du contenu
    const buffer = await readFile(tmpPath);
    const fileHash = createHash("sha1").update(buffer).digest("hex");

    // Vérification doublon
    if (!force) {
      const existing = await prisma.course.findFirst({ where: { fileHash, isActive: true } });
      if (existing) {
        await rm(tmpPath, { force: true });
        tmpPath = null;
        return NextResponse.json({ duplicate: true, existingTitle: existing.title, existingId: existing.id });
      }
    }

    // Déplacement vers le dossier final
    const courseHash = fileHash.slice(0, 12);
    const courseDir = path.join(UPLOAD_DIR, "courses", courseHash);
    mkdirSync(courseDir, { recursive: true });
    const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalPath = path.join(courseDir, safeName);
    await rename(tmpPath, finalPath);
    tmpPath = null;

    const relPath = path.join("courses", courseHash, safeName);

    // Catégorie = nom de l'équipe du créateur (managed team en priorité, sinon première équipe)
    let category: string | null = null;
    if (createdById) {
      const managedTeam = await prisma.team.findFirst({ where: { managerId: createdById }, select: { name: true } });
      if (managedTeam) {
        category = managedTeam.name;
      } else {
        const userTeam = await prisma.userTeam.findFirst({ where: { userId: createdById }, include: { team: { select: { name: true } } } });
        category = userTeam?.team.name ?? null;
      }
    }

    const course = await prisma.course.create({
      data: { title, category, duration, hasQuiz, passingScore, filePath: relPath, originalFileName: file.originalName, fileSize: BigInt(file.size), fileHash, createdById },
    });

    await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.upload", targetId: course.id, targetLabel: title });
    return NextResponse.json({ ok: true, courseId: course.id });

  } catch (err) {
    if (tmpPath) rm(tmpPath, { force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
