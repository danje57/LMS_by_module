import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { getMailConfig } from "@/lib/mail-config";
import { templateAssignment } from "@/lib/mail-templates";

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

  // Vérifier que le manager/creator est autorisé à affecter CE cours
  if (!isAdmin) {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
    const isOwn = course?.createdById === session.user.id;
    if (!isOwn) {
      // Manager : vérifier si le créateur du cours est membre d'une de ses équipes
      const isManager = await prisma.userRole.findFirst({
        where: { userId: session.user.id, role: { name: "manager" } },
      });
      if (!isManager) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

      if (course?.createdById) {
        const creatorInTeam = await prisma.userTeam.findFirst({
          where: {
            userId: course.createdById,
            team: { managerId: session.user.id },
          },
        });
        if (!creatorInTeam) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }
    }
  }

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
        data: {
          courseId,
          userId,
          dueDate: dueDate ? new Date(dueDate) : null,
          assignedById,
          assigningTeamId,
          notifiedAssignedAt: null,
        },
      })
    ),
    ...toUpdate.map(([userId, dueDate]) =>
      prisma.courseAssignment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { dueDate: dueDate ? new Date(dueDate) : null },
      })
    ),
  ]);

  // Envoyer les emails d'affectation (hors transaction — best-effort)
  if (toAdd.length && await isMailConfigured()) {
    const newUserIds = toAdd.map(([userId]) => userId);
    const [newUsers, course, assigner, mailCfg] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: newUserIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
      prisma.user.findUnique({ where: { id: assignedById }, select: { name: true } }),
      getMailConfig(),
    ]);

    const branding = {
      appName: mailCfg.fromName,
      appUrl: mailCfg.appUrl ?? undefined,
    };
    const dueDateMap = new Map(toAdd.map(([userId, dueDate]) => [userId, dueDate]));

    await Promise.allSettled(
      newUsers.map((u) => {
        const dd = dueDateMap.get(u.id);
        const { subject, html } = templateAssignment({
          branding,
          userName: u.name ?? u.email,
          courseTitle: course?.title ?? "Formation",
          dueDate: dd ? new Date(dd) : null,
          assignedByName: assigner?.name ?? null,
        });
        return sendMail({ to: u.email, subject, html }).then(() =>
          prisma.courseAssignment.update({
            where: { userId_courseId: { userId: u.id, courseId } },
            data: { notifiedAssignedAt: new Date() },
          })
        );
      })
    );
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.assign", targetId: courseId, targetLabel: course?.title, details: { added: toAdd.length, removed: toRemove.length } });

  // Notifications in-app pour les nouveaux apprenants
  if (toAdd.length && course) {
    await Promise.allSettled(
      toAdd.map(([userId, dueDate]) =>
        createNotification({
          userId,
          type: "course_assigned",
          title: "Nouveau cours assigné",
          message: `"${course.title}" vous a été affecté${dueDate ? ` — échéance le ${new Date(dueDate).toLocaleDateString("fr-FR")}` : ""}.`,
          link: "/dashboard/courses",
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}

// PATCH — mise à jour de la deadline d'un seul utilisateur
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  const allowed = isAdmin || await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
  });
  if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;
  const { userId, dueDate } = await req.json() as { userId: string; dueDate: string | null };

  await prisma.courseAssignment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  });

  return NextResponse.json({ ok: true });
}
