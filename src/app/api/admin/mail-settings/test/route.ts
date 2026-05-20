import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { templateAssignment } from "@/lib/mail-templates";
import { getMailConfig } from "@/lib/mail-config";

export async function POST() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  if (!await isMailConfigured()) {
    return NextResponse.json({ error: "Mail non configuré — vérifiez vos paramètres." }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!admin) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const mailCfg = await getMailConfig();
  const branding = { appName: mailCfg.fromName, appUrl: mailCfg.appUrl ?? undefined };

  const { subject, html } = templateAssignment({
    branding,
    userName: admin.name ?? admin.email,
    courseTitle: "Cours de démonstration",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignedByName: "LMS Système",
  });

  try {
    await sendMail({ to: admin.email, subject: `[TEST] ${subject}`, html });
    return NextResponse.json({ ok: true, sentTo: admin.email });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
