import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword: string;
    newPassword: string;
  };

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash)
    return NextResponse.json({ error: "Compte sans mot de passe local." }, { status: 400 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });

  const check = validatePassword(newPassword);
  if (!check.valid)
    return NextResponse.json({ error: `Mot de passe trop faible — requis : ${check.errors.join(", ")}.` }, { status: 400 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  return NextResponse.json({ ok: true });
}
