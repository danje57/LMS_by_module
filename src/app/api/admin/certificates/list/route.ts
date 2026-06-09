import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  let allowedUserIds: string[] | null = null;

  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    allowedUserIds = await getManagedUserIds(session.user.id);
  }

  const { searchParams } = req.nextUrl;
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 20;
  const search = searchParams.get("search")?.trim() ?? "";
  const type   = searchParams.get("type") ?? "all";   // all | courses | grc
  const view   = searchParams.get("view") ?? "table"; // table | grouped | team

  const typeFilter = type === "courses" ? { isPdf: false } : type === "grc" ? { isPdf: true } : {};
  const searchFilter = search ? {
    OR: [
      { user: { name: { contains: search, mode: "insensitive" as const } } },
      { user: { email: { contains: search, mode: "insensitive" as const } } },
      { courseTitle: { contains: search, mode: "insensitive" as const } },
    ],
  } : {};

  const where = {
    ...(allowedUserIds ? { userId: { in: allowedUserIds } } : {}),
    ...typeFilter,
    ...searchFilter,
  };

  // ── Team view ─────────────────────────────────────────────────────────────
  if (view === "team") {
    const teams = await prisma.team.findMany({
      where: isAdmin ? {} : { managerId: session.user.id },
      include: { members: { select: { userId: true } } },
      orderBy: { name: "asc" },
    });

    const totalTeams = teams.length;
    const pageTeams  = teams.slice((page - 1) * limit, page * limit);
    const memberIds  = [...new Set(pageTeams.flatMap((t) => t.members.map((m) => m.userId)))];

    const certs = memberIds.length > 0
      ? await prisma.certificate.findMany({
          where: { userId: { in: memberIds }, ...typeFilter, ...searchFilter },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { completedAt: "desc" },
        })
      : [];

    const groups = pageTeams.map((team) => {
      const teamCerts = certs.filter((c) => team.members.some((m) => m.userId === c.userId));
      const byUser = new Map<string, { userId: string; userName: string; userEmail: string; certs: typeof teamCerts }>();
      for (const c of teamCerts) {
        if (!byUser.has(c.userId)) {
          byUser.set(c.userId, {
            userId: c.userId,
            userName: c.user.name ?? c.user.email,
            userEmail: c.user.email,
            certs: [],
          });
        }
        byUser.get(c.userId)!.certs.push(c);
      }
      return {
        teamId: team.id,
        teamName: team.name,
        totalMembers: team.members.length,
        certCount: teamCerts.length,
        members: [...byUser.values()].sort((a, b) =>
          (a.userName ?? "").localeCompare(b.userName ?? "", "fr")
        ).map((m) => ({
          ...m,
          certs: m.certs.map((c) => ({
            id: c.id,
            courseTitle: c.courseTitle,
            isPdf: c.isPdf,
            hasQuiz: c.hasQuiz,
            completedAt: c.completedAt.toISOString(),
          })),
        })),
      };
    });

    return NextResponse.json({ view: "team", groups, totalTeams, page, limit });
  }

  // ── Grouped by user ───────────────────────────────────────────────────────
  if (view === "grouped") {
    const userGroups = await prisma.certificate.groupBy({
      by: ["userId"],
      where,
      _count: true,
      orderBy: { userId: "asc" },
    });

    const totalUsers = userGroups.length;
    const pageUsers  = userGroups.slice((page - 1) * limit, page * limit);
    const userIds    = pageUsers.map((g) => g.userId);

    const certs = await prisma.certificate.findMany({
      where: { ...where, userId: { in: userIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { completedAt: "desc" },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true, name: true, email: true,
        teams: { select: { team: { select: { name: true } } } },
      },
    });

    const groups = users.map((u) => ({
      userId:    u.id,
      userName:  u.name ?? u.email,
      userEmail: u.email,
      teamNames: u.teams.map((t) => t.team.name),
      certs: certs
        .filter((c) => c.userId === u.id)
        .map((c) => ({
          id: c.id, courseTitle: c.courseTitle, isPdf: c.isPdf,
          hasQuiz: c.hasQuiz, completedAt: c.completedAt.toISOString(),
        })),
    })).sort((a, b) => (a.userName ?? "").localeCompare(b.userName ?? "", "fr"));

    return NextResponse.json({ view: "grouped", groups, totalUsers, page, limit });
  }

  // ── Flat table ────────────────────────────────────────────────────────────
  const [total, rows] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    view: "table",
    rows: rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name ?? c.user.email,
      userEmail: c.user.email,
      courseTitle: c.courseTitle,
      isPdf: c.isPdf,
      hasQuiz: c.hasQuiz,
      completedAt: c.completedAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
}
