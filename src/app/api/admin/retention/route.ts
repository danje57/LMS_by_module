import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const setting = await prisma.brandingSetting.findFirst({
    select: { auditLogRetentionDays: true },
  });
  return NextResponse.json({ auditLogRetentionDays: setting?.auditLogRetentionDays ?? 180 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  try {
    const body = await req.json();
    const days = parseInt(body?.auditLogRetentionDays, 10);
    if (isNaN(days) || days < 0)
      return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });

    const existing = await prisma.brandingSetting.findFirst();
    if (existing) {
      await prisma.brandingSetting.update({ where: { id: existing.id }, data: { auditLogRetentionDays: days } });
    } else {
      await prisma.brandingSetting.create({ data: { auditLogRetentionDays: days } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[retention PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
