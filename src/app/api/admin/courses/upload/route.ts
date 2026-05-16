import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWriteStream, mkdirSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_H5P_SIZE = 600 * 1024 * 1024; // 600 Mo

function parseMultipart(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { path: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_H5P_SIZE },
    });

    const fields: Record<string, string> = {};
    let fileResult: { path: string; originalName: string; size: number } | null = null;

    // On attend deux signaux avant de résoudre :
    // 1. busboy a fini de parser le multipart
    // 2. le writeStream a fini d'écrire sur disque
    let busboyDone = false;
    let writeDone = false;
    let hasFile = false;

    function tryResolve() {
      if (busboyDone && (writeDone || !hasFile)) {
        resolve({ fields, file: fileResult });
      }
    }

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (_, stream, info) => {
      hasFile = true;
      const { filename } = info;

      if (!filename.toLowerCase().endsWith(".h5p")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .h5p sont acceptés"));
      }

      const hash = createHash("sha1")
        .update(`${Date.now()}-${filename}`)
        .digest("hex")
        .substring(0, 12);

      const courseDir = path.join(UPLOAD_DIR, "courses", hash);
      mkdirSync(courseDir, { recursive: true });

      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(courseDir, safeName);
      const relativePath = path.join("courses", hash, safeName);

      let size = 0;
      const writeStream = createWriteStream(filePath);

      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => reject(new Error("Fichier trop volumineux (max 600 Mo)")));

      stream.pipe(writeStream);

      writeStream.on("finish", () => {
        fileResult = { path: relativePath, originalName: filename, size };
        writeDone = true;
        tryResolve();
      });

      writeStream.on("error", reject);
    });

    bb.on("finish", () => {
      busboyDone = true;
      tryResolve();
    });

    bb.on("error", reject);

    // Pipe le ReadableStream Web vers busboy
    const nodeStream = Readable.fromWeb(req.body as import("stream/web").ReadableStream);
    nodeStream.on("error", reject);
    nodeStream.pipe(bb);
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let parsed: Awaited<ReturnType<typeof parseMultipart>>;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'upload";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { fields, file } = parsed;
  const title = fields.title?.trim();
  const duration = parseInt(fields.duration ?? "", 10);
  const hasQuiz = fields.hasQuiz === "on";
  const passingScore =
    hasQuiz && fields.passingScore
      ? Math.max(0, Math.min(100, parseInt(fields.passingScore, 10)))
      : null;

  if (!title) return NextResponse.json({ error: "Le titre est requis" }, { status: 400 });
  if (isNaN(duration) || duration < 1) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  await prisma.course.create({
    data: {
      title,
      duration,
      hasQuiz,
      passingScore,
      filePath: file.path,
      originalFileName: file.originalName,
      fileSize: BigInt(file.size),
    },
  });

  return NextResponse.json({ ok: true });
}
