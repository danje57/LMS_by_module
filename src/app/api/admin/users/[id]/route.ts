import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RoleType } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const { name, email, password, isActive, roles } = await req.json();

  if (id === session.user.id && isActive === false)
    return NextResponse.json({ error: "Impossible de se désactiver soi-même" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name?.trim() || null;
  if (email !== undefined) data.email = email.trim().toLowerCase();
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    if (roles !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      const roleRecords = await tx.role.findMany({
        where: { name: { in: roles as RoleType[] } },
      });
      await tx.userRole.createMany({
        data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
      });
    }
    return tx.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: true } } },
    });
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    roles: user.roles.map((ur) => ur.role.name),
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

  if (id === session.user.id)
    return NextResponse.json({ error: "Impossible de supprimer son propre compte" }, { status: 400 });

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
