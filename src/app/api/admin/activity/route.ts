import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SEVEN_DAYS_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function getRetentionDate(): Promise<Date | null> {
  const setting = await prisma.brandingSetting.findFirst({ select: { auditLogRetentionDays: true } });
  const days = setting?.auditLogRetentionDays ?? 180;
  if (days === 0) return null; // illimité
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const COURSE_ACTIONS = new Set([
  "course.start", "course.complete", "quiz.submit",
  "certificate.generate", "certificate.download",
]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mode    = searchParams.get("mode") ?? "history";   // "week" | "history"
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit   = 25;
  const search  = searchParams.get("search") ?? "";
  const csv     = searchParams.get("csv") === "1";

  const retentionDate = await getRetentionDate();
  const since = mode === "week" ? SEVEN_DAYS_AGO() : (retentionDate ?? new Date(0));

  const where = {
    createdAt: { gte: since },
    action: { in: [...COURSE_ACTIONS] },
    ...(search ? {
      OR: [
        { actorName:  { contains: search, mode: "insensitive" as const } },
        { actorEmail: { contains: search, mode: "insensitive" as const } },
        { targetLabel:{ contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  if (csv) {
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { createdAt: true, actorName: true, actorEmail: true, action: true, targetLabel: true },
    });

    const ACTION_LABELS: Record<string, string> = {
      "course.start":          "Cours démarré",
      "course.complete":       "Cours terminé",
      "quiz.submit":           "Quiz soumis",
      "certificate.generate":  "Certificat généré",
      "certificate.download":  "Certificat consulté",
    };

    const header = "Date,Utilisateur,Email,Action,Cours\n";
    const lines = rows.map((r) => [
      new Date(r.createdAt).toLocaleString("fr-FR"),
      r.actorName ?? "",
      r.actorEmail ?? "",
      ACTION_LABELS[r.action] ?? r.action,
      r.targetLabel ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new NextResponse(header + lines, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activite_${mode}.csv"`,
      },
    });
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, createdAt: true, actorName: true, actorEmail: true, action: true, targetLabel: true },
    }),
  ]);

  // Distinct active users count for the week
  let activeUsersCount: number | null = null;
  if (mode === "week") {
    const distinct = await prisma.auditLog.findMany({
      where: { createdAt: { gte: SEVEN_DAYS_AGO() }, action: { in: [...COURSE_ACTIONS] } },
      distinct: ["actorId"],
      select: { actorId: true },
    });
    activeUsersCount = distinct.filter((x) => x.actorId).length;
  }

  return NextResponse.json({ rows, total, page, limit, activeUsersCount });
}
