import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function esc(v: string | null | undefined) {
  if (v == null) return "";
  return `"${String(v).replace(/"/g, '""')}"`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR");
}

function statusLabel(isDone: boolean, progress: number) {
  if (isDone) return "Terminé";
  if (progress > 0) return "En cours";
  return "Non commencé";
}

const USER_SELECT = {
  id: true, name: true, email: true,
  teams: { include: { team: { select: { id: true, name: true } } } },
  assignments: {
    select: {
      courseId: true, dueDate: true, assignedAt: true,
      course: { select: { id: true, title: true } },
    },
  },
  courseProgress: { select: { courseId: true, progress: true } },
  certificates: { select: { courseId: true, completedAt: true } },
  quizResults: { select: { courseId: true, score: true, passingScore: true, passed: true, completedAt: true }, orderBy: { completedAt: "desc" as const } },
} as const;

type RawUser = Awaited<ReturnType<typeof prisma.user.findMany<{ select: typeof USER_SELECT }>>>[number];

function buildRows(users: RawUser[]) {
  const rows: string[] = [];
  for (const u of users) {
    const progressMap = new Map(u.courseProgress.map((p) => [p.courseId, p.progress]));
    const certMap = new Map(u.certificates.map((c) => [c.courseId, c.completedAt]));
    const quizMap = new Map(u.quizResults.map((q) => [q.courseId, q]));
    const teams = u.teams.map((t) => t.team.name).join(", ");

    for (const a of u.assignments) {
      const isDone = certMap.has(a.courseId);
      const progress = isDone ? 100 : (progressMap.get(a.courseId) ?? 0);
      const quiz = quizMap.get(a.courseId);
      const completedAt = certMap.get(a.courseId) ?? null;

      rows.push([
        esc(u.name ?? u.email),
        esc(u.email),
        esc(teams),
        esc(a.course.title),
        esc(statusLabel(isDone, progress)),
        `${progress}`,
        quiz ? `${quiz.score}` : "",
        quiz ? `${quiz.passingScore}` : "",
        quiz ? (quiz.passed ? "Oui" : "Non") : "",
        esc(fmtDate(completedAt)),
        esc(fmtDate(a.dueDate)),
      ].join(";"));
    }
  }
  return rows;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = session.user.id;
  const isAdmin = session.user.sessionMode === "admin";
  const roles = session.user.roles;
  const isManager = roles.includes("manager");
  const isCreator = roles.includes("creator");

  if (!isAdmin && !isManager && !isCreator) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let users: RawUser[] = [];

  if (isAdmin) {
    users = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: "learner" } } } },
      select: USER_SELECT,
      orderBy: { name: "asc" },
    });
  } else if (isManager) {
    const managedTeams = await prisma.team.findMany({
      where: { managerId: userId },
      select: { id: true, members: { select: { userId: true } } },
    });
    const managedTeamIds = managedTeams.map((t) => t.id);
    const teamMemberIds = managedTeams.flatMap((t) => t.members.map((m) => m.userId));

    // Affectations via les équipes du manager (inclut celles faites par les créateurs)
    const teamAssignmentUserIds = managedTeamIds.length > 0
      ? await prisma.courseAssignment
          .findMany({ where: { assigningTeamId: { in: managedTeamIds } }, select: { userId: true } })
          .then((r) => r.map((a) => a.userId))
      : [];

    // Affectations directes faites par le manager lui-même
    const directAssignmentUserIds = await prisma.courseAssignment
      .findMany({ where: { assignedById: userId, assigningTeamId: null }, select: { userId: true } })
      .then((r) => r.map((a) => a.userId));

    const ids = [...new Set([...teamMemberIds, ...teamAssignmentUserIds, ...directAssignmentUserIds])];
    users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: USER_SELECT, orderBy: { name: "asc" } });
  } else if (isCreator) {
    const assignedUserIds = await prisma.courseAssignment
      .findMany({ where: { assignedById: userId }, select: { userId: true } })
      .then((r) => [...new Set(r.map((a) => a.userId))]);
    users = await prisma.user.findMany({ where: { id: { in: assignedUserIds }, isActive: true }, select: USER_SELECT, orderBy: { name: "asc" } });
  }

  const header = "Apprenant;Email;Équipe(s);Cours;Statut;Progression %;Score quiz;Seuil quiz;Quiz réussi;Date complétion;Deadline";
  const rows = buildRows(users);
  const csv = "﻿" + [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="progression_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
