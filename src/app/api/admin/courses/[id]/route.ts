import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rm } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  return NextResponse.json({ ...course, fileSize: course.fileSize.toString() });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const { title, duration, hasQuiz, passingScore } = await req.json();

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(duration !== undefined ? { duration: Number(duration) } : {}),
      ...(hasQuiz !== undefined ? { hasQuiz: !!hasQuiz } : {}),
      ...(passingScore !== undefined ? { passingScore: passingScore !== null ? Number(passingScore) : null } : {}),
    },
  });
  return NextResponse.json({ ...updated, fileSize: updated.fileSize.toString() });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }

  // Vérifier AVANT suppression si un autre cours partage le même dossier (même fileHash)
  const siblings = course.fileHash
    ? await prisma.course.count({ where: { fileHash: course.fileHash, id: { not: id } } })
    : 0;

  // Supprimer en base
  await prisma.course.delete({ where: { id } });

  // Supprimer les fichiers sur disque uniquement si aucun autre cours ne partage le même contenu
  if (siblings === 0) {
    try {
      const courseDir = path.join(UPLOAD_DIR, path.dirname(course.filePath));
      await rm(courseDir, { recursive: true, force: true });
    } catch {
      // On ne bloque pas si le fichier a déjà disparu
    }
  }

  return NextResponse.json({ ok: true });
}
