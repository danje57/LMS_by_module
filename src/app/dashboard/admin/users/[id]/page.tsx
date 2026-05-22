import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, BookOpen, CircleCheck, Clock, Award, Tag, Calendar, LogIn, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

async function getData(id: string) {
  const [user, assignments, lastLogin] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        teams: { include: { team: { select: { id: true, name: true } } } },
      },
    }),
    prisma.courseAssignment.findMany({
      where: { userId: id },
      include: {
        course: {
          select: { id: true, title: true, hasQuiz: true, passingScore: true, duration: true, category: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.auditLog.findFirst({
      where: { actorId: id, action: "auth.login" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (!user) return null;

  const courseIds = assignments.map((a) => a.courseId);

  const [progressList, quizResults, certs] = await Promise.all([
    prisma.userCourseProgress.findMany({ where: { userId: id, courseId: { in: courseIds } } }),
    prisma.userQuizResult.findMany({
      where: { userId: id, courseId: { in: courseIds } },
      orderBy: { attempt: "desc" },
    }),
    prisma.certificate.findMany({ where: { userId: id, courseId: { in: courseIds } } }),
  ]);

  const progressMap = Object.fromEntries(progressList.map((p) => [p.courseId, p]));
  const quizMap: Record<string, typeof quizResults[0]> = {};
  const quizCountMap: Record<string, number> = {};
  for (const q of quizResults) {
    if (!quizMap[q.courseId]) quizMap[q.courseId] = q;
    quizCountMap[q.courseId] = (quizCountMap[q.courseId] ?? 0) + 1;
  }
  const certMap = Object.fromEntries(
    certs.filter((c) => c.courseId).map((c) => [c.courseId!, c])
  );

  const rows = assignments.map((a) => {
    const prog = progressMap[a.courseId];
    const quiz = quizMap[a.courseId];
    const cert = certMap[a.courseId];
    const status: "not_started" | "in_progress" | "completed" =
      prog?.completedAt ? "completed" : prog ? "in_progress" : "not_started";
    return {
      courseId: a.courseId,
      courseTitle: a.course.title,
      courseCategory: a.course.category,
      hasQuiz: a.course.hasQuiz,
      passingScore: a.course.passingScore,
      duration: a.course.duration,
      assignedAt: a.assignedAt.toISOString(),
      dueDate: a.dueDate?.toISOString() ?? null,
      status,
      completedAt: prog?.completedAt?.toISOString() ?? null,
      progress: prog?.progress ?? 0,
      quizScore: quiz?.score ?? null,
      quizPassed: quiz?.passed ?? null,
      quizAttempts: quizCountMap[a.courseId] ?? 0,
      certificateId: cert?.id ?? null,
    };
  });

  const completedCount = rows.filter((r) => r.status === "completed").length;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      roles: user.roles.map((ur) => ur.role.name),
      teams: user.teams.map((ut) => ({ id: ut.team.id, name: ut.team.name })),
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
    },
    assignments: rows,
    stats: {
      assignedCount: assignments.length,
      completedCount,
      completionRate: assignments.length > 0 ? Math.round((completedCount / assignments.length) * 100) : 0,
      certCount: certs.length,
    },
  };
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-600",
  manager: "bg-purple-50 text-purple-600",
  creator: "bg-amber-50 text-amber-600",
  learner: "bg-blue-50 text-blue-600",
};

const STATUS_CONFIG = {
  not_started: { color: "text-[#8E8E93]", bg: "bg-[#F5F5F7] dark:bg-[#2C2C2E]", icon: Clock },
  in_progress: { color: "text-[#0071E3]", bg: "bg-blue-50 dark:bg-[#0071E3]/10", icon: BookOpen },
  completed:   { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: CircleCheck },
};

export default async function LearnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { id } = await params;
  const data = await getData(id);
  if (!data) redirect("/dashboard/admin/users");

  const t = await getTranslations("learnerProfile");
  const tCommon = await getTranslations("common");
  const locale = "fr"; // language from session would require extra fetch — using fr as default

  const { user, assignments, stats } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/admin/users"
          className="p-2 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#ADADB8] dark:text-[#636366] font-medium">{t("subtitle")}</p>
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
            {user.name ?? user.email}
          </h1>
        </div>
        <span className={cn(
          "text-[12px] font-medium px-2.5 py-1 rounded-lg",
          user.isActive ? "bg-green-50 text-green-600" : "bg-[#F5F5F7] text-[#6E6E73]"
        )}>
          {user.isActive ? t("active") : t("inactive")}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("assignedCourses"), value: stats.assignedCount, icon: BookOpen, color: "text-[#0071E3]", bg: "bg-blue-50 dark:bg-[#0071E3]/10" },
          { label: t("completed"), value: stats.completedCount, icon: CircleCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: t("completionRate"), value: `${stats.completionRate}%`, icon: BarChart2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
          { label: t("certificates"), value: stats.certCount, icon: Award, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", kpi.bg)}>
              <kpi.icon className={cn("w-4 h-4", kpi.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none">{kpi.value}</p>
              <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5 leading-tight">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User info card */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex flex-wrap gap-5">
        <div className="flex items-center gap-2 text-[13px] text-[#3C3C43] dark:text-[#AEAEB2]">
          <span className="text-[#8E8E93]">Email</span>
          <span className="font-medium">{user.email}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[#8E8E93]">{t("roles")}</span>
          <div className="flex gap-1">
            {user.roles.length === 0
              ? <span className="text-[#ADADB8]">—</span>
              : user.roles.map((r) => (
                <span key={r} className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md capitalize", ROLE_COLORS[r] ?? "bg-[#F5F5F7] text-[#6E6E73]")}>{r}</span>
              ))}
          </div>
        </div>
        {user.teams.length > 0 && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#8E8E93]">{t("teams")}</span>
            <div className="flex gap-1">
              {user.teams.map((tm) => (
                <span key={tm.id} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{tm.name}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
          <Calendar className="w-3.5 h-3.5" />
          <span>{t("memberSince")} {fmtDate(user.createdAt, locale)}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
          <LogIn className="w-3.5 h-3.5" />
          <span>{t("lastLogin")} {user.lastLoginAt ? fmtDate(user.lastLoginAt, locale) : t("never")}</span>
        </div>
      </div>

      {/* Assignments table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F5F5F7] dark:border-[#3A3A3C]">
          <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t("assignedCoursesTitle")}
            <span className="ml-2 text-[12px] font-normal text-[#8E8E93]">{stats.assignedCount}</span>
          </h2>
        </div>

        {assignments.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="w-8 h-8 text-[#D2D2D7] mx-auto mb-2" />
            <p className="text-[13px] text-[#8E8E93]">{t("noCourses")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
            {assignments.map((row) => {
              const cfg = STATUS_CONFIG[row.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={row.courseId} className="px-5 py-4 flex items-start gap-4">
                  {/* Status icon */}
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", cfg.bg)}>
                    <StatusIcon className={cn("w-4 h-4", cfg.color)} />
                  </div>

                  {/* Course info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{row.courseTitle}</p>
                      {row.courseCategory && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10 rounded-lg px-2 py-0.5">
                          <Tag className="w-3 h-3" />
                          {row.courseCategory}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <span className="text-[11px] text-[#8E8E93]">
                        {t("assignedOn")} {fmtDate(row.assignedAt, locale)}
                      </span>
                      {row.dueDate && (
                        <span className={cn("text-[11px]", new Date(row.dueDate) < new Date() && row.status !== "completed" ? "text-red-500" : "text-[#8E8E93]")}>
                          {t("dueDate")} {fmtDate(row.dueDate, locale)}
                        </span>
                      )}
                      {row.completedAt && (
                        <span className="text-[11px] text-emerald-600">
                          {t("completedOn")} {fmtDate(row.completedAt, locale)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: quiz + cert */}
                  <div className="flex items-center gap-2 shrink-0">
                    {row.hasQuiz && row.quizScore !== null && (
                      <span className={cn(
                        "text-[12px] font-medium px-2.5 py-1 rounded-lg",
                        row.quizPassed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                      )}>
                        {row.quizScore}%
                        {row.quizAttempts > 1 && (
                          <span className="ml-1 text-[10px] opacity-70">×{row.quizAttempts}</span>
                        )}
                      </span>
                    )}
                    {row.certificateId && (
                      <Link
                        href={`/dashboard/certificates/${row.certificateId}`}
                        className="p-1.5 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
                        title={t("viewCertificate")}
                      >
                        <Award className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
