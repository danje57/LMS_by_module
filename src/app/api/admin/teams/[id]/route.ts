import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const { name, managerId } = await req.json();

  const data: { name?: string; managerId?: string | null } = {};
  if (name !== undefined) data.name = name.trim();
  if (managerId !== undefined) data.managerId = managerId ?? null;

  const team = await prisma.team.update({
    where: { id },
    data,
    include: {
      manager: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  // Si un manager est assigné, s'assurer qu'il est membre de l'équipe
  if (managerId) {
    await prisma.userTeam.upsert({
      where: { userId_teamId: { userId: managerId, teamId: id } },
      update: {},
      create: { userId: managerId, teamId: id },
    });
    // Recharger avec le membre potentiellement ajouté
    const updated = await prisma.team.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (updated) {
      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        manager: updated.manager,
        members: updated.members.map((m) => m.user),
      });
    }
  }

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "team.edit", targetId: id, targetLabel: team.name, details: { name, managerId } });
  return NextResponse.json({
    id: team.id,
    name: team.name,
    manager: team.manager,
    members: team.members.map((m) => m.user),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, select: { name: true } });
  await prisma.team.delete({ where: { id } });
  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "team.delete", targetId: id, targetLabel: team?.name });
  return NextResponse.json({ ok: true });
}
