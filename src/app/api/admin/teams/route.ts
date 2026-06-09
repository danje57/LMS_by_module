import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(teams.map((t) => ({
    id: t.id,
    name: t.name,
    manager: t.manager,
    members: t.members.map((m) => m.user),
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const team = await prisma.team.create({
    data: { name: name.trim() },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "team.create", targetId: team.id, targetLabel: team.name });
  return NextResponse.json({ id: team.id, name: team.name, manager: null, members: [] }, { status: 201 });
}
