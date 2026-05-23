import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

// GET — récupérer la vidéo native + questions
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const nativeVideo = await prisma.nativeVideo.findUnique({
    where: { courseId: id },
    include: { questions: { orderBy: { timestamp: "asc" } } },
  });

  return NextResponse.json(nativeVideo ?? null);
}

// POST — upload vidéo + création NativeVideo
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Vérifier que le cours existe et appartient à l'utilisateur (ou admin/manager)
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("video") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier vidéo manquant" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (![".mp4", ".webm", ".mov"].includes(ext))
    return NextResponse.json({ error: "Format non supporté (mp4, webm, mov)" }, { status: 400 });

  const slug = crypto.randomBytes(8).toString("hex");
  const filename = `${slug}${ext}`;
  const uploadDir = path.join(process.cwd(), "uploads", "videos");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Supprimer l'ancienne vidéo si elle existe
  const existing = await prisma.nativeVideo.findUnique({ where: { courseId: id } });
  if (existing) {
    try { await unlink(path.join(process.cwd(), "uploads", "videos", path.basename(existing.videoPath))); } catch { /* ignore */ }
    await prisma.nativeVideo.delete({ where: { courseId: id } });
  }

  const nativeVideo = await prisma.nativeVideo.create({
    data: {
      courseId: id,
      videoPath: `videos/${filename}`,
    },
  });

  // Mettre à jour courseType
  await prisma.course.update({
    where: { id },
    data: { courseType: "native_video", originalFileName: file.name, fileSize: BigInt(buffer.length) },
  });

  return NextResponse.json({ ok: true, id: nativeVideo.id, videoPath: nativeVideo.videoPath });
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

  // Remplacer toutes les questions
  await prisma.nativeVideoQuestion.deleteMany({ where: { videoId: nativeVideo.id } });

  if (Array.isArray(questions) && questions.length > 0) {
    await prisma.nativeVideoQuestion.createMany({
      data: questions.map((q: { timestamp: number; question: string; choices: { id: string; text: string; correct: boolean }[]; order: number }) => ({
        videoId: nativeVideo.id,
        timestamp: q.timestamp,
        question: q.question,
        choices: q.choices as object[],
        order: q.order ?? 0,
      })),
    });
  }

  if (typeof duration === "number") {
    await prisma.nativeVideo.update({ where: { id: nativeVideo.id }, data: { duration } });
  }

  return NextResponse.json({ ok: true });
}
