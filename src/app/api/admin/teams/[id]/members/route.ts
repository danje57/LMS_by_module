import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: teamId } = await params;
  const { userId } = await req.json();

  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId, teamId } },
    update: {},
    create: { userId, teamId },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "team.member.add", targetId: teamId, targetLabel: team?.name, details: { userId, userName: user?.name, userEmail: user?.email } });
  return NextResponse.json(user, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: teamId } = await params;
  const { userId } = await req.json();

  const removedUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const teamInfo = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await prisma.userTeam.delete({ where: { userId_teamId: { userId, teamId } } });
  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "team.member.remove", targetId: teamId, targetLabel: teamInfo?.name, details: { userId, userName: removedUser?.name, userEmail: removedUser?.email } });
  return NextResponse.json({ ok: true });
}
