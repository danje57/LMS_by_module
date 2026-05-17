import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;

  const assignments = await prisma.courseAssignment.findMany({
    where: { courseId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { assignedAt: "asc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      email: a.user.email,
      dueDate: a.dueDate?.toISOString() ?? null,
    }))
  );
}

// PUT — synchronise les assignations : ajoute les nouvelles, supprime les retirées
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;
  const { assignments } = await req.json() as {
    assignments: { userId: string; dueDate: string | null }[];
  };

  const incoming = new Map(assignments.map((a) => [a.userId, a.dueDate]));

  const existing = await prisma.courseAssignment.findMany({
    where: { courseId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));

  const toAdd = [...incoming.entries()].filter(([id]) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !incoming.has(id));
  const toUpdate = [...incoming.entries()].filter(([id]) => existingIds.has(id));

  // Parmi les utilisateurs re-ajoutés, trouver ceux qui ont déjà de la progression
  const toAddIds = toAdd.map(([userId]) => userId);
  const existingProgress = toAddIds.length
    ? await prisma.userCourseProgress.findMany({
        where: { courseId, userId: { in: toAddIds } },
        select: { userId: true },
      })
    : [];
  const usersToReset = new Set(existingProgress.map((p) => p.userId));

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.courseAssignment.deleteMany({ where: { courseId, userId: { in: toRemove } } })]
      : []),

    // Réinitialisation du cycle pour les utilisateurs re-affectés
    ...[...usersToReset].flatMap((userId) => [
      prisma.certificate.deleteMany({ where: { userId, courseId } }),
      prisma.userCourseProgress.update({
        where: { userId_courseId: { userId, courseId } },
        data: { completedAt: null, progress: 0, visitedSlides: [] },
      }),
    ]),

    ...toAdd.map(([userId, dueDate]) =>
      prisma.courseAssignment.create({
        data: { courseId, userId, dueDate: dueDate ? new Date(dueDate) : null },
      })
    ),
    ...toUpdate.map(([userId, dueDate]) =>
      prisma.courseAssignment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { dueDate: dueDate ? new Date(dueDate) : null },
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
