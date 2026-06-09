import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  try {
    const body = await req.json();
    const { maintenanceBannerEnabled, maintenanceBannerMessage, maintenanceBannerColor, maintenanceBannerEndsAt } = body;

    if (typeof maintenanceBannerEnabled !== "boolean")
      return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });

    const endsAtDate = maintenanceBannerEndsAt ? new Date(maintenanceBannerEndsAt) : null;
    if (endsAtDate && endsAtDate <= new Date())
      return NextResponse.json({ error: "La date de fin doit être dans le futur." }, { status: 400 });

    const data = {
      maintenanceBannerEnabled,
      maintenanceBannerMessage: maintenanceBannerMessage ?? null,
      maintenanceBannerColor: maintenanceBannerColor ?? "orange",
      maintenanceBannerEndsAt: endsAtDate,
    };

    const existing = await prisma.brandingSetting.findFirst();
    if (existing) {
      await prisma.brandingSetting.update({ where: { id: existing.id }, data });
    } else {
      await prisma.brandingSetting.create({ data });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[maintenance-banner PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
