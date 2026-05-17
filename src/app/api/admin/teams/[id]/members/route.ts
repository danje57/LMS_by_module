import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.userTeam.delete({
    where: { userId_teamId: { userId, teamId } },
  });

  return NextResponse.json({ ok: true });
}
