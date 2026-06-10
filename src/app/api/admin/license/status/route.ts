import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.sessionMode !== "admin") return NextResponse.json({ error: "Mode admin requis" }, { status: 403 });

  const config = await prisma.instanceConfig.findFirst({
    select: {
      licenseId: true,
      company: true,
      email: true,
      licenseExpiresAt: true,
      renewalInProgress: true,
    },
  });

  const history = await prisma.licenseHistory.findMany({
    orderBy: { replacedAt: "desc" },
    select: { licenseId: true, company: true, email: true, expiresAt: true, replacedAt: true },
  });

  if (!config?.licenseId) return NextResponse.json({ activated: false, history });

  const now     = new Date();
  const expired = config.licenseExpiresAt ? config.licenseExpiresAt < now : false;
  const daysLeft = config.licenseExpiresAt
    ? Math.ceil((config.licenseExpiresAt.getTime() - now.getTime()) / 86400000)
    : null;

  return NextResponse.json({
    activated: true,
    licenseId: config.licenseId,
    company:   config.company,
    email:     config.email,
    expiresAt: config.licenseExpiresAt?.toISOString() ?? null,
    expired,
    daysLeft,
    renewalInProgress: config.renewalInProgress,
    history,
  });
}
