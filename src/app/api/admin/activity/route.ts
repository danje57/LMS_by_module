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

const ALL_ACTIONS = [
  "course.start", "course.complete", "quiz.submit",
  "certificate.generate", "certificate.download",
  "document.upload", "document.edit", "document.view", "document.signed", "document.force-signed", "document.delete",
];

const ACTION_GROUPS: Record<string, string[]> = {
  course:      ["course.start", "course.complete"],
  quiz:        ["quiz.submit"],
  certificate: ["certificate.generate", "certificate.download"],
  document:    ["document.upload", "document.edit", "document.view", "document.signed", "document.force-signed", "document.delete"],
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mode         = searchParams.get("mode") ?? "history";
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit        = 25;
  const search       = searchParams.get("search") ?? "";
  const actionFilter = searchParams.get("actionFilter") ?? "all";
  const fromParam    = searchParams.get("from");
  const toParam      = searchParams.get("to");
  const csv          = searchParams.get("csv") === "1";

  const retentionDate = await getRetentionDate();

  let since: Date;
  let until: Date | undefined;

  if (fromParam || toParam) {
    since = fromParam ? new Date(fromParam) : new Date(0);
    if (toParam) {
      until = new Date(toParam);
      until.setHours(23, 59, 59, 999);
    }
  } else {
    since = mode === "week" ? SEVEN_DAYS_AGO() : (retentionDate ?? new Date(0));
  }

  const allowedActions = actionFilter !== "all" && ACTION_GROUPS[actionFilter]
    ? ACTION_GROUPS[actionFilter]
    : ALL_ACTIONS;

  const where = {
    createdAt: { gte: since, ...(until ? { lte: until } : {}) },
    action: { in: allowedActions },
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
      "course.start":            "Cours démarré",
      "course.complete":         "Cours terminé",
      "quiz.submit":             "Quiz soumis",
      "certificate.generate":    "Certificat généré",
      "certificate.download":    "Certificat consulté",
      "document.upload":         "Document uploadé",
      "document.edit":           "Document modifié",
      "document.view":           "Document consulté",
      "document.signed":         "Document signé",
      "document.force-signed":   "Signature forcée (admin)",
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
  if (mode === "week" && !fromParam && !toParam) {
    const distinct = await prisma.auditLog.findMany({
      where: { createdAt: { gte: SEVEN_DAYS_AGO() }, action: { in: allowedActions } },
      distinct: ["actorId"],
      select: { actorId: true },
    });
    activeUsersCount = distinct.filter((x) => x.actorId).length;
  }

  return NextResponse.json({ rows, total, page, limit, activeUsersCount });
}
