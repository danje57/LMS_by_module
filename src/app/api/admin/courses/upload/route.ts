import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_H5P_SIZE = 600 * 1024 * 1024; // 600 Mo

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const form = await req.formData();

  const title = (form.get("title") as string | null)?.trim();
  const durationRaw = form.get("duration") as string | null;
  const hasQuiz = form.get("hasQuiz") === "on";
  const passingScoreRaw = form.get("passingScore") as string | null;
  const file = form.get("file") as File | null;

  if (!title || !durationRaw || !file) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const duration = parseInt(durationRaw, 10);
  if (isNaN(duration) || duration < 1) {
    return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
  }

  // Validation stricte côté serveur
  if (!file.name.endsWith(".h5p")) {
    return NextResponse.json({ error: "Seuls les fichiers .h5p sont acceptés" }, { status: 400 });
  }
  if (file.size > MAX_H5P_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 600 Mo)" }, { status: 400 });
  }

  const passingScore = hasQuiz && passingScoreRaw
    ? Math.max(0, Math.min(100, parseInt(passingScoreRaw, 10)))
    : null;

  // Nom de dossier unique basé sur un hash + timestamp
  const hash = createHash("sha1")
    .update(`${Date.now()}-${file.name}`)
    .digest("hex")
    .substring(0, 12);

  const courseDir = path.join(UPLOAD_DIR, "courses", hash);
  await mkdir(courseDir, { recursive: true });

  const h5pPath = path.join(courseDir, file.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(h5pPath, buffer);

  const relativePath = path.join("courses", hash, path.basename(h5pPath));

  await prisma.course.create({
    data: {
      title,
      duration,
      hasQuiz,
      passingScore,
      filePath: relativePath,
      originalFileName: file.name,
      fileSize: BigInt(file.size),
    },
  });

  return NextResponse.json({ ok: true });
}
