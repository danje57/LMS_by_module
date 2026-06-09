import { NextRequest, NextResponse } from "next/server";
import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { mode, password } = await req.json() as { mode: "admin" | "user"; password?: string };

  if (mode !== "admin" && mode !== "user") {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }

  const canAdmin = session.user.roles.includes("admin") || session.user.roles.includes("superadmin");
  if (mode === "admin" && !canAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Vérification du mot de passe uniquement pour le passage en mode admin
  if (mode === "admin") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (user?.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
      }
    }
    // Comptes SSO sans mot de passe local : pas de vérification
  }

  await updateSession({ sessionMode: mode } as Parameters<typeof updateSession>[0]);
  return NextResponse.json({ ok: true });
}
