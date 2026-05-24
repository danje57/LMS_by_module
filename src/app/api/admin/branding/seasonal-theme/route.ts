import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  try {
    const { seasonalThemesEnabled } = await req.json();
    if (typeof seasonalThemesEnabled !== "boolean")
      return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });

    const existing = await prisma.brandingSetting.findFirst();
    if (existing) {
      await prisma.brandingSetting.update({ where: { id: existing.id }, data: { seasonalThemesEnabled } });
    } else {
      await prisma.brandingSetting.create({ data: { seasonalThemesEnabled } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[seasonal-theme PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
