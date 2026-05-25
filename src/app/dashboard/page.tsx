import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BookOpen, Users, CircleCheck, Clock, LayoutList, Circle, TrendingUp, Award, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PresenceCard } from "@/components/admin/presence-card";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { Suspense } from "react";

const ACTION_LABELS: Record<string, string> = {
  "auth.login":           "Connexion",
  "auth.logout":          "Déconnexion",
  "auth.login_failed":    "Échec connexion",
  "course.upload":        "Cours créé",
  "course.edit":          "Cours modifié",
  "course.delete":        "Cours supprimé",
  "course.assign":        "Cours affecté",
  "course.start":         "Cours démarré",
  "course.complete":      "Cours terminé",
  "quiz.submit":          "Quiz soumis",
  "certificate.download": "Certificat consulté",
  "certificate.generate": "Certificat généré",
  "user.create":          "Utilisateur créé",
  "user.edit":            "Utilisateur modifié",
  "user.delete":          "Utilisateur supprimé",
  "user.activate":        "Compte réactivé",
  "user.deactivate":      "Compte suspendu",
  "user.reset_password":  "Mot de passe réinitialisé",
  "user.import":          "Import utilisateurs",
  "team.create":          "Équipe créée",
  "team.edit":            "Équipe modifiée",
  "team.delete":          "Équipe supprimée",
  "team.member.add":      "Membre ajouté",
  "team.member.remove":   "Membre retiré",
  "team.import":          "Import équipes",
  "settings.branding":    "Branding modifié",
  "settings.mail":        "Email modifié",
  "setup.init":           "Installation initiale",
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

async function getAdminStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    courseCount, userCount, totalAssignments, certCount, activeLogins,
    pdfCount, pdfAssignments, pdfSignatures,
    courseStartedPairs, pdfViewPairs,
  ] = await Promise.all([
    prisma.course.count({ where: { isActive: true, courseType: { not: "pdf" } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.courseAssignment.count({ where: { course: { courseType: { not: "pdf" } } } }),
    prisma.certificate.count({ where: { course: { courseType: { not: "pdf" } } } }),
    prisma.auditLog.findMany({
      where: { action: "auth.login", createdAt: { gte: sevenDaysAgo } },
      distinct: ["actorId"],
      select: { actorId: true },
    }),
    prisma.course.count({ where: { courseType: "pdf", isActive: true } }),
    prisma.courseAssignment.count({ where: { course: { courseType: "pdf", isActive: true } } }),
    prisma.pdfSignature.count(),
    prisma.userCourseProgress.groupBy({
      by: ["userId", "courseId"],
      where: { course: { courseType: { not: "pdf" }, isActive: true } },
    }).then((r) => r.length),
    prisma.auditLog.groupBy({
      by: ["actorId", "targetId"],
      where: { action: "document.view", actorId: { not: null }, targetId: { not: null } },
    }).then((r) => r.length),
  ]);

  const activeThisWeek   = activeLogins.filter((x) => x.actorId).length;
  const courseInProgress = Math.max(0, courseStartedPairs - certCount);
  const courseNotStarted = Math.max(0, totalAssignments - courseStartedPairs);
  const pdfSignatureRate = pdfAssignments > 0 ? Math.min(100, Math.round((pdfSignatures / pdfAssignments) * 100)) : 0;
  const pdfInProgress    = Math.max(0, pdfViewPairs - pdfSignatures);
  const pdfNotStarted    = Math.max(0, pdfAssignments - pdfViewPairs);

  return {
    courseCount, userCount, activeThisWeek,
    totalAssignments, certCount, courseInProgress, courseNotStarted,
    pdfCount, pdfAssignments, pdfSignatures, pdfSignatureRate, pdfInProgress, pdfNotStarted,
  };
}

async function getRecentActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, createdAt: true, actorName: true, action: true, targetLabel: true },
  });
}

async function getUserStats(userId: string) {
  const [assignments, pdfAssignments, pdfSignatures, pdfViewLogs] = await Promise.all([
    prisma.courseAssignment.findMany({
      where: { userId, course: { courseType: { not: "pdf" } } },
      select: { courseId: true },
    }),
    prisma.courseAssignment.findMany({
      where: { userId, course: { courseType: "pdf", isActive: true } },
      select: { courseId: true },
    }),
    prisma.pdfSignature.findMany({
      where: { userId },
      select: { courseId: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId, action: "document.view" },
      distinct: ["targetId"],
      select: { targetId: true },
    }),
  ]);

  const assignedIds = assignments.map((a) => a.courseId);
  const total = assignedIds.length;

  const pdfAssignedIds = new Set(pdfAssignments.map((a) => a.courseId));
  const pdfSignedIds   = new Set(pdfSignatures.map((s) => s.courseId));
  const pdfViewedIds   = new Set(pdfViewLogs.map((l) => l.targetId).filter((id): id is string => !!id));

  const pdfTotal      = pdfAssignedIds.size;
  const pdfSigned     = [...pdfSignedIds].filter((id) => pdfAssignedIds.has(id)).length;
  const pdfInProgress = [...pdfViewedIds].filter((id) => pdfAssignedIds.has(id) && !pdfSignedIds.has(id)).length;
  const pdfNotStarted = [...pdfAssignedIds].filter((id) => !pdfSignedIds.has(id) && !pdfViewedIds.has(id)).length;
  const pdfPending    = pdfTotal - pdfSigned;

  if (total === 0) return { total: 0, completed: 0, inProgress: 0, notStarted: 0, pdfTotal, pdfSigned, pdfInProgress, pdfNotStarted, pdfPending };

  const [certSet, progressSet] = await Promise.all([
    prisma.certificate
      .findMany({ where: { userId, courseId: { in: assignedIds } }, select: { courseId: true }, distinct: ["courseId"] })
      .then((r) => new Set(r.map((c) => c.courseId))),
    prisma.userCourseProgress
      .findMany({ where: { userId, courseId: { in: assignedIds } }, select: { courseId: true } })
      .then((r) => new Set(r.map((p) => p.courseId))),
  ]);

  const completed  = certSet.size;
  const inProgress = [...progressSet].filter((id) => !certSet.has(id)).length;
  const notStarted = total - completed - inProgress;

  return { total, completed, inProgress, notStarted, pdfTotal, pdfSigned, pdfInProgress, pdfNotStarted, pdfPending };
}

export default async function DashboardPage() {
  const session    = await auth();
  const isAdmin    = session?.user.sessionMode === "admin";
  const userId     = session?.user.id ?? "";
  const firstName  = session?.user.name?.split(" ")[0] ?? session?.user.email ?? "";
  const t          = await getTranslations("dashboard");

  const adminStats     = isAdmin ? await getAdminStats()       : null;
  const recentActivity = isAdmin ? await getRecentActivity()   : null;
  const userStats      = !isAdmin ? await getUserStats(userId) : null;
  const branding = await prisma.brandingSetting.findFirst({
    select: { seasonalThemesEnabled: true, maintenanceBannerEnabled: true, maintenanceBannerEndsAt: true },
  });
  const maintenanceActive =
    (branding?.maintenanceBannerEnabled ?? false) &&
    (!branding?.maintenanceBannerEndsAt || new Date() <= branding.maintenanceBannerEndsAt);
  const seasonalEnabled = !maintenanceActive && (branding?.seasonalThemesEnabled ?? false);

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      <Suspense><SeasonalBanner enabled={seasonalEnabled} /></Suspense>

      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("helloUser", { name: firstName })}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">
          {isAdmin ? t("overviewPlatform") : t("overviewTraining")}
        </p>
      </div>

      {isAdmin && adminStats && (
        <>
          {/* Utilisateurs + Actifs cette semaine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-500/10">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{t("users")}</p>
                <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{adminStats.userCount}</p>
              </div>
            </div>
            <Link href="/dashboard/admin/activity?mode=week" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3 hover:border-[#0071E3]/40 hover:shadow-sm transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-50 dark:bg-sky-500/10">
                <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{t("activeThisWeek")}</p>
                <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{adminStats.activeThisWeek}</p>
              </div>
            </Link>
          </div>

          {/* Section Cours */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[#0071E3]" />
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Cours</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Cours actifs",   value: adminStats.courseCount,     icon: BookOpen,    iconColor: "bg-blue-50 dark:bg-[#0071E3]/10 text-[#0071E3]",                              bar: null },
                { label: "Non commencés",  value: adminStats.courseNotStarted, icon: Circle,      iconColor: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73]",                              bar: "bg-[#D2D2D7]" },
                { label: "En cours",       value: adminStats.courseInProgress, icon: Clock,       iconColor: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",                            bar: "bg-amber-400" },
                { label: "Terminés",       value: adminStats.certCount,        icon: CircleCheck, iconColor: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-400" },
              ].map((s) => {
                const Icon = s.icon;
                const pct = adminStats.totalAssignments > 0 ? Math.round((s.value / adminStats.totalAssignments) * 100) : 0;
                return (
                  <div key={s.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                      <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{s.value}</p>
                    </div>
                    {s.bar && adminStats.totalAssignments > 0 && (
                      <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Documents GRC */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Documents GRC</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Documents actifs", value: adminStats.pdfCount,       icon: ShieldCheck, iconColor: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",    bar: null },
                { label: "Non lus",          value: adminStats.pdfNotStarted,  icon: Circle,      iconColor: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73]",                              bar: "bg-[#D2D2D7]" },
                { label: "En cours",         value: adminStats.pdfInProgress,  icon: Clock,       iconColor: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",                            bar: "bg-amber-400" },
                { label: "Signés",           value: adminStats.pdfSignatures,  icon: CircleCheck, iconColor: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-400" },
              ].map((s) => {
                const Icon = s.icon;
                const pct = adminStats.pdfAssignments > 0 ? Math.round((s.value / adminStats.pdfAssignments) * 100) : 0;
                return (
                  <Link key={s.label} href="/dashboard/documents?tab=library"
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3 hover:border-[#0071E3]/40 hover:shadow-sm transition-all">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                      <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{s.value}</p>
                    </div>
                    {s.bar && adminStats.pdfAssignments > 0 && (
                      <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Présence */}
          <PresenceCard />

          {/* Recent activity */}
          {recentActivity && recentActivity.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("recentActivity")}</h2>
                <Link href="/dashboard/admin/audit" className="text-[13px] text-[#0071E3] hover:underline">{t("viewAll")}</Link>
              </div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] overflow-hidden">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                    <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] w-32 shrink-0 truncate">
                      {entry.actorName ?? "—"}
                    </p>
                    <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2 py-0.5 rounded-lg whitespace-nowrap">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] flex-1 truncate">
                      {entry.targetLabel ?? ""}
                    </p>
                    <p className="text-[12px] text-[#ADADB8] dark:text-[#636366] whitespace-nowrap shrink-0">
                      {timeAgo(new Date(entry.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!isAdmin && userStats && (
        <div className="space-y-6">

          {/* Cours */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[#0071E3]" />
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Mes cours</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t("total"),      value: userStats.total,      icon: LayoutList,  iconColor: "bg-blue-50 dark:bg-[#0071E3]/10 text-[#0071E3]",                               bar: null },
                { label: t("notStarted"), value: userStats.notStarted, icon: Circle,      iconColor: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73]",                               bar: "bg-[#D2D2D7]" },
                { label: t("inProgress"), value: userStats.inProgress, icon: Clock,       iconColor: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",                             bar: "bg-amber-400" },
                { label: t("completed"),  value: userStats.completed,  icon: CircleCheck, iconColor: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",  bar: "bg-emerald-400" },
              ].map((s) => {
                const Icon = s.icon;
                const pct = userStats.total > 0 ? Math.round((s.value / userStats.total) * 100) : 0;
                return (
                  <div key={s.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                      <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{s.value}</p>
                    </div>
                    {s.bar && userStats.total > 0 && (
                      <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents PDF */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Mes documents</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total",
                  value: userStats.pdfTotal,
                  icon: FileText,
                  iconColor: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                  bar: null,
                  barColor: null,
                },
                {
                  label: "Non démarrés",
                  value: userStats.pdfNotStarted,
                  icon: Circle,
                  iconColor: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73]",
                  bar: userStats.pdfTotal,
                  barColor: "bg-[#D2D2D7]",
                },
                {
                  label: "En cours",
                  value: userStats.pdfInProgress,
                  icon: Clock,
                  iconColor: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",
                  bar: userStats.pdfTotal,
                  barColor: "bg-amber-400",
                },
                {
                  label: "Signés",
                  value: userStats.pdfSigned,
                  icon: CircleCheck,
                  iconColor: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  bar: userStats.pdfTotal,
                  barColor: "bg-emerald-400",
                },
              ].map((s) => {
                const Icon = s.icon;
                const pct = s.bar ? Math.round((s.value / s.bar) * 100) : 0;
                return (
                  <Link
                    key={s.label}
                    href="/dashboard/documents"
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-3 hover:border-[#0071E3]/40 hover:shadow-sm transition-all"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                      <p className="text-[30px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{s.value}</p>
                    </div>
                    {s.bar && s.bar > 0 && (
                      <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-3">{t("quickActions")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/dashboard/courses/upload" className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#0071E3]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("addCourse")}</p>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("uploadH5P")}</p>
              </div>
            </Link>
            <Link href="/dashboard/admin/users" className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("manageUsers")}</p>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("accountsRolesTeams")}</p>
              </div>
            </Link>
          </div>
        </div>
      )}


      {!isAdmin && (
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-3">{t("quickAccess")}</h2>
          <Link href="/dashboard/courses" className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#0071E3]/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#0071E3]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("myCourses")}</p>
              <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("accessAssignedTrainings")}</p>
            </div>
          </Link>
        </div>
      )}

    </div>
  );
}
