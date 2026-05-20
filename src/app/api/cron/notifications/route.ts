import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { getMailConfig } from "@/lib/mail-config";
import {
  templateDeadlineWarning,
  templateDeadlineExpired,
} from "@/lib/mail-templates";

// Protégé par CRON_SECRET — à appeler via cron système :
//   0 8 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/notifications

// Logique hybride identique à celle de l'interface :
// seuil = max(15% de la durée totale assignedAt→dueDate, 3 jours)
function isWithinWarningThreshold(assignedAt: Date, dueDate: Date, now: Date): boolean {
  const totalMs = dueDate.getTime() - assignedAt.getTime();
  const thresholdMs = Math.max(totalMs * 0.15, 3 * 24 * 60 * 60 * 1000);
  const msLeft = dueDate.getTime() - now.getTime();
  return msLeft > 0 && msLeft <= thresholdMs;
}

function daysLeft(dueDate: Date, now: Date): number {
  return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(req: NextRequest) {
  // Vérification du secret (DB en priorité, puis env)
  const mailCfg = await getMailConfig();
  const secret = mailCfg.cronSecret;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!await isMailConfigured()) {
    return NextResponse.json({ error: "Mail non configuré" }, { status: 503 });
  }

  const now = new Date();
  const branding = { appName: mailCfg.fromName, appUrl: mailCfg.appUrl ?? undefined };

  // Récupère toutes les affectations avec deadline, non terminées
  const assignments = await prisma.courseAssignment.findMany({
    where: {
      dueDate: { not: null },
      user: { isActive: true },
    },
    select: {
      id: true,
      userId: true,
      courseId: true,
      assignedAt: true,
      dueDate: true,
      notifiedWarningAt: true,
      notifiedExpiredAt: true,
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  // Exclure ceux qui ont un certificat (= terminés)
  const completedCerts = await prisma.certificate.findMany({
    where: {
      userId: { in: assignments.map((a) => a.userId) },
      courseId: { in: assignments.map((a) => a.courseId) },
    },
    select: { userId: true, courseId: true },
  });
  const completedSet = new Set(completedCerts.map((c) => `${c.userId}:${c.courseId}`));

  let warned = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const a of assignments) {
    const key = `${a.userId}:${a.courseId}`;
    if (completedSet.has(key)) continue;
    if (!a.dueDate) continue;

    const isExpired = a.dueDate < now;
    const isWarning = !isExpired && isWithinWarningThreshold(a.assignedAt, a.dueDate, now);

    try {
      // Deadline dépassée
      if (isExpired && !a.notifiedExpiredAt) {
        const { subject, html } = templateDeadlineExpired({
          branding,
          userName: a.user.name ?? a.user.email,
          courseTitle: a.course.title,
          dueDate: a.dueDate,
        });
        await sendMail({ to: a.user.email, subject, html });
        await prisma.courseAssignment.update({
          where: { id: a.id },
          data: { notifiedExpiredAt: now },
        });
        expired++;
      }

      // Deadline approchante (seulement si pas encore expiré et pas encore notifié)
      if (isWarning && !a.notifiedWarningAt) {
        const days = daysLeft(a.dueDate, now);
        const { subject, html } = templateDeadlineWarning({
          branding,
          userName: a.user.name ?? a.user.email,
          courseTitle: a.course.title,
          dueDate: a.dueDate,
          daysLeft: days,
        });
        await sendMail({ to: a.user.email, subject, html });
        await prisma.courseAssignment.update({
          where: { id: a.id },
          data: { notifiedWarningAt: now },
        });
        warned++;
      }
    } catch (err) {
      errors.push(`${a.user.email} / ${a.course.title}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, warned, expired, errors });
}
