import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rm } from "fs/promises";
import path from "path";
import { auditLog } from "@/lib/audit";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Vérifie si un utilisateur non-admin a le droit de modifier/supprimer un cours
// Règles : propre cours OU cours d'un créateur dans son équipe (manager)
//          OU cours accessible via le manager de son équipe (créateur)
async function hasRightsOnCourse(userId: string, courseCreatedById: string | null): Promise<boolean> {
  if (courseCreatedById === userId) return true;

  const isManager = await prisma.userRole.findFirst({
    where: { userId, role: { name: "manager" } },
  });

  if (isManager) {
    if (!courseCreatedById) return false;
    const creatorInTeam = await prisma.userTeam.findFirst({
      where: { userId: courseCreatedById, team: { managerId: userId } },
    });
    return !!creatorInTeam;
  }

  // Créateur : vérifier via son/ses manager(s)
  if (!courseCreatedById) return false;
  const creatorTeams = await prisma.userTeam.findMany({
    where: { userId },
    include: { team: { select: { managerId: true } } },
  });
  const managerIds = creatorTeams.map((ut) => ut.team.managerId).filter(Boolean) as string[];
  for (const managerId of managerIds) {
    if (courseCreatedById === managerId) return true;
    const creatorInTeam = await prisma.userTeam.findFirst({
      where: { userId: courseCreatedById, team: { managerId } },
    });
    if (creatorInTeam) return true;
  }
  return false;
}

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
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const isAdmin = session.user.sessionMode === "admin";

  if (!isAdmin) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
    const ok = await hasRightsOnCourse(session.user.id, course.createdById);
    if (!ok) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { title, category, duration, hasQuiz, passingScore, createdById } = await req.json();

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(category !== undefined ? { category: category?.trim() || null } : {}),
      ...(duration !== undefined ? { duration: Number(duration) } : {}),
      ...(hasQuiz !== undefined ? { hasQuiz: !!hasQuiz } : {}),
      ...(passingScore !== undefined ? { passingScore: passingScore !== null ? Number(passingScore) : null } : {}),
      // createdById modifiable uniquement par l'admin
      ...(isAdmin && createdById !== undefined ? { createdById: createdById || null } : {}),
    },
  });
  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.edit", targetId: id, targetLabel: updated.title, details: { title, duration, hasQuiz, passingScore } });
  return NextResponse.json({ ...updated, fileSize: updated.fileSize.toString() });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const isAdmin = session.user.sessionMode === "admin";

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }

  // Vérification droits pour manager/creator
  if (!isAdmin) {
    const ok = await hasRightsOnCourse(session.user.id, course.createdById);
    if (!ok) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
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

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.delete", targetId: id, targetLabel: course.title });
  return NextResponse.json({ ok: true });
}
