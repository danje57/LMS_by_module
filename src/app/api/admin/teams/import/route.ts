import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type CsvRow = { team: string; email: string; role: "manager" | "membre" };

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { rows }: { rows: CsvRow[] } = await req.json();
  if (!rows?.length) return NextResponse.json({ error: "Aucune ligne." }, { status: 400 });

  const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()))];
  const users = await prisma.user.findMany({ where: { email: { in: emails }, isActive: true }, select: { id: true, email: true, name: true } });
  const userMap = new Map(users.map((u) => [u.email, u]));

  const errors: { line: number; email: string; message: string }[] = [];
  rows.forEach((r, i) => {
    if (!userMap.has(r.email.trim().toLowerCase())) {
      errors.push({ line: i + 2, email: r.email, message: "Utilisateur introuvable ou inactif" });
    }
  });
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  // Grouper par équipe
  const teamMap = new Map<string, { managerId: string | null; memberIds: string[] }>();
  for (const r of rows) {
    const teamName = r.team.trim();
    const user = userMap.get(r.email.trim().toLowerCase())!;
    if (!teamMap.has(teamName)) teamMap.set(teamName, { managerId: null, memberIds: [] });
    const entry = teamMap.get(teamName)!;
    if (r.role === "manager") entry.managerId = user.id;
    if (!entry.memberIds.includes(user.id)) entry.memberIds.push(user.id);
  }

  let teamsCreated = 0;
  let teamsUpdated = 0;
  let membersAdded = 0;

  for (const [name, { managerId, memberIds }] of teamMap) {
    let team = await prisma.team.findFirst({ where: { name } });
    if (!team) {
      team = await prisma.team.create({ data: { name, managerId } });
      teamsCreated++;
    } else {
      await prisma.team.update({ where: { id: team.id }, data: { managerId: managerId ?? team.managerId } });
      teamsUpdated++;
    }

    for (const userId of memberIds) {
      const exists = await prisma.userTeam.findUnique({ where: { userId_teamId: { userId, teamId: team.id } } });
      if (!exists) {
        await prisma.userTeam.create({ data: { userId, teamId: team.id } });
        membersAdded++;
      }
    }
  }

  return NextResponse.json({ teamsCreated, teamsUpdated, membersAdded });
}
