import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — liste des affectations actuelles (manager/créateur)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const allowed = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
  });
  if (!allowed && session.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;
  const assignments = await prisma.courseAssignment.findMany({
    where: { courseId },
    include: { user: { select: { id: true, name: true, email: true } } },
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

// PUT — synchronise les affectations (manager/créateur)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";

  // Vérifier rôle manager ou creator
  const roleRecord = !isAdmin
    ? await prisma.userRole.findFirst({
        where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
      })
    : null;

  if (!isAdmin && !roleRecord)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;
  const { assignments, teamContextId } = await req.json() as {
    assignments: { userId: string; dueDate: string | null }[];
    teamContextId: string | null;
  };

  // Valider que teamContextId appartient bien à l'utilisateur
  let assigningTeamId: string | null = null;
  if (teamContextId) {
    const membership = await prisma.userTeam.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: teamContextId } },
    });
    // Accepter aussi si l'utilisateur est manager de cette équipe
    const managed = await prisma.team.findFirst({
      where: { id: teamContextId, managerId: session.user.id },
    });
    if (membership || managed) assigningTeamId = teamContextId;
  }

  const assignedById = session.user.id;
  const incoming = new Map(assignments.map((a) => [a.userId, a.dueDate]));

  const existing = await prisma.courseAssignment.findMany({
    where: { courseId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));

  const toAdd    = [...incoming.entries()].filter(([id]) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !incoming.has(id));
  const toUpdate = [...incoming.entries()].filter(([id]) => existingIds.has(id));

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
    ...[...usersToReset].flatMap((userId) => [
      prisma.certificate.deleteMany({ where: { userId, courseId } }),
      prisma.userCourseProgress.update({
        where: { userId_courseId: { userId, courseId } },
        data: { completedAt: null, progress: 0, visitedSlides: [] },
      }),
    ]),
    ...toAdd.map(([userId, dueDate]) =>
      prisma.courseAssignment.create({
        data: { courseId, userId, dueDate: dueDate ? new Date(dueDate) : null, assignedById, assigningTeamId },
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
