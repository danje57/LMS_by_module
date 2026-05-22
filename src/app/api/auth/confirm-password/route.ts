import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash) return NextResponse.json({ error: "Impossible de vérifier." }, { status: 400 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });

  return NextResponse.json({ ok: true });
}
