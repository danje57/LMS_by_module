import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rm } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }

  // Supprimer en base
  await prisma.course.delete({ where: { id } });

  // Supprimer le dossier du cours sur disque (best-effort)
  try {
    const courseDir = path.join(UPLOAD_DIR, path.dirname(course.filePath));
    await rm(courseDir, { recursive: true, force: true });
  } catch {
    // On ne bloque pas si le fichier a déjà disparu
  }

  return NextResponse.json({ ok: true });
}
