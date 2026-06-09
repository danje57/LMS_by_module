import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createWriteStream, mkdirSync } from "fs";
import { rename, rm } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_PDF_SIZE = 100 * 1024 * 1024;

function parseMultipart(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { tmpPath: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_PDF_SIZE } });
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
      if (!filename.toLowerCase().endsWith(".pdf")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .pdf sont acceptés"));
      }

      const tmpId = createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 12);
      const tmpDir = path.join(UPLOAD_DIR, "tmp");
      mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `${tmpId}.pdf`);

      let size = 0;
      const ws = createWriteStream(tmpPath);
      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => reject(new Error("Fichier trop volumineux (max 100 Mo)")));
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
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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
    if (!file) return NextResponse.json({ error: "Fichier PDF manquant" }, { status: 400 });

    tmpPath = file.tmpPath;
    const title    = fields.title?.trim();
    const duration = parseInt(fields.duration ?? "15", 10);

    if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

    // Département : manuel pour l'admin, sinon auto-dérivé de l'équipe du créateur
    let category: string | null = null;
    if (isAdmin && fields.category?.trim()) {
      category = fields.category.trim();
    } else {
      const creatorId = session.user.id;
      const managedTeam = await prisma.team.findFirst({ where: { managerId: creatorId }, select: { name: true } });
      if (managedTeam) {
        category = managedTeam.name;
      } else {
        const userTeam = await prisma.userTeam.findFirst({ where: { userId: creatorId }, include: { team: { select: { name: true } } } });
        category = userTeam?.team.name ?? null;
      }
    }

    const fileHash = createHash("sha1")
      .update(`${file.originalName}-${file.size}`)
      .digest("hex");

    const destDir = path.join(UPLOAD_DIR, "documents");
    mkdirSync(destDir, { recursive: true });
    const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${fileHash.slice(0, 8)}_${safeName}`;
    const finalPath = path.join(destDir, uniqueName);
    await rename(tmpPath, finalPath);
    tmpPath = null;

    const relPath = path.join("documents", uniqueName);

    const course = await prisma.course.create({
      data: {
        title,
        category,
        duration: isNaN(duration) || duration < 1 ? 15 : duration,
        courseType: "pdf",
        filePath: relPath,
        originalFileName: file.originalName,
        fileSize: BigInt(file.size),
        fileHash,
        hasQuiz: false,
        createdById: session.user.id,
      },
    });

    await auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "document.upload",
      targetId: course.id,
      targetLabel: title,
    });

    // Génération vignette en arrière-plan (non bloquant)
    import("@/lib/pdf-thumbnail").then(({ generateAndSavePdfThumbnail }) =>
      generateAndSavePdfThumbnail(course.id, relPath).then((thumbPath) =>
        prisma.course.update({ where: { id: course.id }, data: { thumbnailPath: thumbPath } })
      )
    ).catch(() => {});

    return NextResponse.json({ ok: true, documentId: course.id });
  } catch (err) {
    if (tmpPath) rm(tmpPath, { force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
