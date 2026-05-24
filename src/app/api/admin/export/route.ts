import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function escapeCsv(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.map(escapeCsv).join(",");
  const body = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  return head + "\n" + body;
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function getManagedUserIds(managerId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: { managerId },
    include: { members: { select: { userId: true } } },
  });
  return teams.flatMap((t) => t.members.map((m) => m.userId));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user.sessionMode === "admin";
  const isManager = !isAdmin && session?.user?.id != null;

  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  // Vérifier que le manager a bien le rôle manager ou creator
  let allowedUserIds: string[] | null = null; // null = tous (admin)
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

    allowedUserIds = await getManagedUserIds(session.user.id);
    if (allowedUserIds.length === 0)
      return NextResponse.json({ error: "Aucune équipe à exporter" }, { status: 403 });
  }

  const type = new URL(req.url).searchParams.get("type");
  const TYPE_LABELS: Record<string, string> = { h5p: "H5P", native_video: "Vidéo", pptx: "PPTX" };

  if (type === "progress") {
    const rows = await prisma.userCourseProgress.findMany({
      where: allowedUserIds ? { userId: { in: allowedUserIds } } : undefined,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, courseType: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const userTeams = await prisma.userTeam.findMany({
      where: { userId: { in: userIds } },
      include: { team: { select: { name: true } } },
    });
    const teamsByUser = new Map<string, string[]>();
    for (const ut of userTeams) {
      const list = teamsByUser.get(ut.userId) ?? [];
      list.push(ut.team.name);
      teamsByUser.set(ut.userId, list);
    }

    const csv = buildCsv(
      ["Nom", "Email", "Équipe(s)", "Cours", "Type", "Progression (%)", "Statut", "Démarré le", "Terminé le"],
      rows.map((r) => [
        r.user.name ?? "",
        r.user.email,
        (teamsByUser.get(r.userId) ?? []).join(" / ") || "—",
        r.course.title,
        TYPE_LABELS[r.course.courseType] ?? r.course.courseType,
        r.progress,
        r.completedAt ? "Terminé" : r.progress > 0 ? "En cours" : "Démarré",
        fmtDate(r.startedAt),
        fmtDate(r.completedAt),
      ]),
    );

    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="progressions_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (type === "quiz") {
    const rows = await prisma.userQuizResult.findMany({
      where: allowedUserIds ? { userId: { in: allowedUserIds } } : undefined,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const userTeams = await prisma.userTeam.findMany({
      where: { userId: { in: userIds } },
      include: { team: { select: { name: true } } },
    });
    const teamsByUser = new Map<string, string[]>();
    for (const ut of userTeams) {
      const list = teamsByUser.get(ut.userId) ?? [];
      list.push(ut.team.name);
      teamsByUser.set(ut.userId, list);
    }

    const csv = buildCsv(
      ["Nom", "Email", "Équipe(s)", "Cours", "Tentative", "Score (%)", "Seuil (%)", "Résultat", "Date"],
      rows.map((r) => [
        r.user.name ?? "",
        r.user.email,
        (teamsByUser.get(r.userId) ?? []).join(" / ") || "—",
        r.course.title,
        r.attempt,
        r.score,
        r.passingScore,
        r.passed ? "Réussi" : "Échoué",
        fmtDate(r.completedAt),
      ]),
    );

    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="quiz_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Type invalide. Utilisez ?type=progress ou ?type=quiz" }, { status: 400 });
}
