import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWriteStream, mkdirSync } from "fs";
import { unlink, rm, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import { execFile } from "child_process";
import { promisify } from "util";
import { encryptVideoBuffer } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = process.env.SCRIPTS_DIR ?? "./scripts";

const MAX_VIDEO_SIZE = 600 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

type Params = { params: Promise<{ id: string }> };

function parseVideoUpload(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { tmpPath: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_VIDEO_SIZE } });
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
      const ext = path.extname(filename).toLowerCase();
      if (![".mp4", ".webm", ".mov"].includes(ext)) {
        stream.resume();
        return reject(new Error("Format non supporté (mp4, webm, mov)"));
      }

      const tmpId = crypto.randomBytes(8).toString("hex");
      const tmpDir = path.join(UPLOAD_DIR, "tmp");
      mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `${tmpId}${ext}`);

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

// GET — récupérer la vidéo native + questions
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const nativeVideo = await prisma.nativeVideo.findUnique({
    where: { courseId: id },
    include: { questions: { orderBy: [{ timestamp: "asc" }, { order: "asc" }] } },
  });

  return NextResponse.json(nativeVideo ?? null);
}

// POST — upload vidéo + création NativeVideo
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  let tmpPath: string | null = null;
  try {
    const { fields, file } = await parseVideoUpload(req);
    if (!file) return NextResponse.json({ error: "Fichier vidéo manquant" }, { status: 400 });
    tmpPath = file.tmpPath;

    const force = fields.force === "true";
    const ext = path.extname(file.originalName).toLowerCase();

    // Lire le fichier pour calculer le hash
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(tmpPath);
    const fileHash = crypto.createHash("sha1").update(buffer).digest("hex");

    // Détection de doublon
    if (!force) {
      const duplicate = await prisma.nativeVideo.findFirst({
        where: { fileHash, course: { isActive: true, id: { not: id } } },
        include: { course: { select: { title: true, id: true } } },
      });
      if (duplicate) {
        await rm(tmpPath, { force: true });
        tmpPath = null;
        return NextResponse.json({
          duplicate: true,
          existingTitle: duplicate.course.title,
          existingId: duplicate.course.id,
        });
      }
    }

    // Générer le thumbnail depuis tmpPath (avant chiffrement)
    let thumbnailPath: string | null = null;
    try {
      const thumbDir = path.join(UPLOAD_DIR, "thumbnails");
      mkdirSync(thumbDir, { recursive: true });
      const thumbDest = path.join(thumbDir, `${id}.jpg`);
      const scriptPath = path.resolve(SCRIPTS_DIR, "generate_video_thumbnail.py");
      await execFileAsync("python3", [scriptPath, tmpPath, thumbDest], { timeout: 60_000 });
      thumbnailPath = `thumbnails/${id}.jpg`;
    } catch { /* thumbnail non critique */ }

    // Déplacer vers le dossier final
    const slug = crypto.randomBytes(8).toString("hex");
    const filename = `${slug}${ext}`;
    const uploadDir = path.join(UPLOAD_DIR, "videos");
    mkdirSync(uploadDir, { recursive: true });
    const finalPath = path.join(uploadDir, filename);
    const { rename } = await import("fs/promises");
    await rename(tmpPath, finalPath);
    tmpPath = null;

    // Chiffrement vidéo (licencing) — AES-256-CTR pour conserver le support Range
    let videoEncryptedKey: string | null = null;
    let videoLicenseEncryptedKey: string | null = null;
    let videoContentLicenseId: string | null = null;
    try {
      const { encrypted, encryptedKey: ek, fileKeyHex } = await encryptVideoBuffer(buffer);
      await writeFile(finalPath, encrypted);
      videoEncryptedKey = ek;
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      if (envelope) { videoLicenseEncryptedKey = envelope.licenseEncryptedKey; videoContentLicenseId = envelope.contentLicenseId; }
    } catch { /* non critique */ }

    // Supprimer l'ancienne vidéo si elle existe
    const existing = await prisma.nativeVideo.findUnique({ where: { courseId: id } });
    if (existing) {
      try { await unlink(path.join(UPLOAD_DIR, existing.videoPath)); } catch { /* ignore */ }
      await prisma.nativeVideo.delete({ where: { courseId: id } });
    }

    const nativeVideo = await prisma.nativeVideo.create({
      data: {
        courseId: id,
        videoPath: `videos/${filename}`,
        fileHash,
        isEncrypted: !!videoEncryptedKey,
        encryptedKey: videoEncryptedKey,
        licenseEncryptedKey: videoLicenseEncryptedKey,
        contentLicenseId:    videoContentLicenseId,
      },
    });

    await prisma.course.update({
      where: { id },
      data: {
        courseType: "native_video",
        originalFileName: file.originalName,
        fileSize: BigInt(file.size),
        ...(thumbnailPath ? { thumbnailPath } : {}),
      },
    });

    return NextResponse.json({ ok: true, id: nativeVideo.id, videoPath: nativeVideo.videoPath });

  } catch (err) {
    if (tmpPath) rm(tmpPath, { force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — sauvegarder questions + durée
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { questions, duration } = body;

  const nativeVideo = await prisma.nativeVideo.findUnique({ where: { courseId: id } });
  if (!nativeVideo) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });

  await prisma.nativeVideoQuestion.deleteMany({ where: { videoId: nativeVideo.id } });

  if (Array.isArray(questions) && questions.length > 0) {
    await prisma.nativeVideoQuestion.createMany({
      data: questions.map((q: { timestamp: number; question: string; choices: { id: string; text: string; correct: boolean }[]; order: number; type?: string; allowMultiple?: boolean; explanation?: string | null }, index: number) => ({
        videoId: nativeVideo.id,
        timestamp: q.timestamp,
        question: q.question,
        choices: q.choices as object[],
        order: index,
        type: (q.type === "vrai_faux" ? "vrai_faux" : "qcm") as "qcm" | "vrai_faux",
        allowMultiple: q.allowMultiple ?? false,
        explanation: q.explanation ?? null,
      })),
    });
  }

  if (typeof duration === "number") {
    await prisma.nativeVideo.update({ where: { id: nativeVideo.id }, data: { duration } });
  }

  return NextResponse.json({ ok: true });
}
