import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
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

    await prisma.course.create({
      data: { title, duration, hasQuiz, passingScore, filePath: relPath, originalFileName: file.originalName, fileSize: BigInt(file.size), fileHash },
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    if (tmpPath) rm(tmpPath, { force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
