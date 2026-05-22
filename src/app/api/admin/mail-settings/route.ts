import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const s = await prisma.mailSetting.findFirst();
  if (!s) return NextResponse.json(null);

  // Ne jamais renvoyer les secrets en clair — on indique juste s'ils sont définis
  return NextResponse.json({
    id: s.id,
    provider: s.provider,
    fromName: s.fromName,
    appUrl: s.appUrl,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpSecure: s.smtpSecure,
    smtpUser: s.smtpUser,
    smtpFrom: s.smtpFrom,
    hasSmtpPass: !!s.smtpPass,
    graphTenantId: s.graphTenantId,
    graphClientId: s.graphClientId,
    graphFrom: s.graphFrom,
    hasGraphSecret: !!s.graphClientSecret,
    hasCronSecret: !!s.cronSecret,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json() as {
    provider: string;
    fromName: string;
    appUrl: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;       // vide = conserver l'existant
    smtpFrom: string;
    graphTenantId: string;
    graphClientId: string;
    graphClientSecret: string; // vide = conserver l'existant
    graphFrom: string;
    cronSecret: string;
  };

  const existing = await prisma.mailSetting.findFirst();

  const data = {
    provider: body.provider,
    fromName: body.fromName || "LMS Notifications",
    appUrl: body.appUrl || null,
    smtpHost: body.smtpHost || null,
    smtpPort: body.smtpPort || 587,
    smtpSecure: !!body.smtpSecure,
    smtpUser: body.smtpUser || null,
    smtpFrom: body.smtpFrom || null,
    graphTenantId: body.graphTenantId || null,
    graphClientId: body.graphClientId || null,
    graphFrom: body.graphFrom || null,
    // Champs sensibles : ne mettre à jour que si une nouvelle valeur est fournie
    ...(body.smtpPass ? { smtpPass: body.smtpPass } : {}),
    ...(body.graphClientSecret ? { graphClientSecret: body.graphClientSecret } : {}),
    ...(body.cronSecret ? { cronSecret: body.cronSecret } : {}),
  };

  const setting = existing
    ? await prisma.mailSetting.update({ where: { id: existing.id }, data })
    : await prisma.mailSetting.create({ data });

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "settings.mail", details: { provider: data.provider } });
  return NextResponse.json({ ok: true, id: setting.id });
}
