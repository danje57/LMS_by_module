import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateStrongPassword } from "@/lib/password";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { getMailConfig } from "@/lib/mail-config";
import { templateAccountCreated } from "@/lib/mail-templates";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id)
    return NextResponse.json({ error: "Utilisez les paramètres de votre compte pour changer votre propre mot de passe." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const newPassword = generateStrongPassword();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  // Envoi par email (best-effort)
  let emailSent = false;
  if (await isMailConfigured()) {
    const mailCfg = await getMailConfig();
    const branding = { appName: mailCfg.fromName, appUrl: mailCfg.appUrl ?? undefined };
    const { subject, html } = templateAccountCreated({
      branding,
      userName: user.name ?? user.email,
      email: user.email,
      password: newPassword,
    });
    emailSent = await sendMail({ to: user.email, subject: `[Réinitialisation] ${subject}`, html })
      .then(() => true)
      .catch(() => false);
  }

  return NextResponse.json({ ok: true, password: newPassword, emailSent });
}
