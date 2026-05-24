import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const setting = await prisma.brandingSetting.findFirst({
    select: { auditLogRetentionDays: true },
  });
  const days = setting?.auditLogRetentionDays ?? 180;

  // 0 = pas de purge (rétention illimitée)
  if (days === 0) {
    return NextResponse.json({ ok: true, purged: 0, message: "Rétention illimitée, aucune purge." });
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ ok: true, purged: count, cutoff: cutoff.toISOString() });
}
