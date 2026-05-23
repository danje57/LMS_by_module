import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Retourne les utilisateurs assignables + équipes + contexte équipes du caller
// Accessible aux admins, managers et créateurs
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  const allowed = isAdmin || await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
  });
  if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const [users, teams, callerTeams] = await Promise.all([
    // Tous les utilisateurs actifs avec rôle opérationnel (jamais les comptes protégés)
    prisma.user.findMany({
      where: { isActive: true, isProtected: false, roles: { some: { role: { name: { in: ["manager", "creator", "learner"] } } } } },
      select: {
        id: true, name: true, email: true,
        roles: { include: { role: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    // Toutes les équipes avec membres
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { members: { select: { userId: true } } },
    }),
    // Équipes auxquelles appartient le caller (pour le sélecteur de contexte)
    prisma.userTeam.findMany({
      where: { userId: session.user.id },
      include: { team: { select: { id: true, name: true } } },
    }),
  ]);

  // Aussi inclure les équipes managées
  const managedTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    select: { id: true, name: true },
  });

  const callerTeamIds = new Set([
    ...callerTeams.map((t) => t.team.id),
    ...managedTeams.map((t) => t.id),
  ]);
  const callerTeamList = [...callerTeamIds].map((id) => {
    const found = callerTeams.find((t) => t.team.id === id)?.team
      ?? managedTeams.find((t) => t.id === id);
    return found ? { id: found.id, name: found.name } : null;
  }).filter(Boolean) as { id: string; name: string }[];

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.roles.map((r) => r.role.name),
    })),
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberIds: t.members.map((m) => m.userId),
    })),
    callerTeams: callerTeamList,
  });
}
