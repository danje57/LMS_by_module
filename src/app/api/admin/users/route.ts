import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RoleType } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { getMailConfig } from "@/lib/mail-config";
import { templateAccountCreated } from "@/lib/mail-templates";
import { validatePassword, generateStrongPassword } from "@/lib/password";

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { roles: { include: { role: true } } },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.roles.map((ur) => ur.role.name),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { name, email, roles } = await req.json();

  if (!email)
    return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });

  const password = generateStrongPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const roleRecords = await prisma.role.findMany({
    where: { name: { in: (roles ?? ["learner"]) as RoleType[] } },
  });

  const user = await prisma.user.create({
    data: {
      name: name?.trim() || null,
      email: email.trim().toLowerCase(),
      passwordHash,
      roles: {
        create: roleRecords.map((r) => ({ roleId: r.id })),
      },
    },
    include: { roles: { include: { role: true } } },
  });

  // Email de bienvenue (best-effort)
  if (await isMailConfigured()) {
    const mailCfg = await getMailConfig();
    const branding = { appName: mailCfg.fromName, appUrl: mailCfg.appUrl ?? undefined };
    const { subject, html } = templateAccountCreated({
      branding,
      userName: user.name ?? user.email,
      email: user.email,
      password,
    });
    await sendMail({ to: user.email, subject, html }).catch(() => null);
  }

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "user.create", targetId: user.id, targetLabel: user.email, details: { name: user.name, roles } });
  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.roles.map((ur) => ur.role.name),
    },
    { status: 201 }
  );
}
