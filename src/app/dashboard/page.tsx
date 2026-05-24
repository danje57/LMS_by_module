import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BookOpen, Users, CircleCheck, Clock, LayoutList, Circle, TrendingUp, Award, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PresenceCard } from "@/components/admin/presence-card";
import { SeasonalBanner } from "@/components/seasonal-banner";

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

  const [courseCount, userCount, totalAssignments, certCount, activeLogins] = await Promise.all([
    prisma.course.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.courseAssignment.count(),
    prisma.certificate.count(),
    prisma.auditLog.findMany({
      where: { action: "auth.login", createdAt: { gte: sevenDaysAgo } },
      distinct: ["actorId"],
      select: { actorId: true },
    }),
  ]);

  const completionRate = totalAssignments > 0
    ? Math.min(100, Math.round((certCount / totalAssignments) * 100))
    : 0;
  const activeThisWeek = activeLogins.filter((x) => x.actorId).length;

  return { courseCount, userCount, completionRate, certCount, activeThisWeek };
}

async function getRecentActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, createdAt: true, actorName: true, action: true, targetLabel: true },
  });
}

async function getUserStats(userId: string) {
  const assignments = await prisma.courseAssignment.findMany({
    where: { userId },
    select: { courseId: true },
  });
  const assignedIds = assignments.map((a) => a.courseId);
  const total = assignedIds.length;

  if (total === 0) return { total: 0, completed: 0, inProgress: 0, notStarted: 0 };

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

  return { total, completed, inProgress, notStarted };
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      <SeasonalBanner />

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
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t("activeCourses"),    value: adminStats.courseCount,    icon: BookOpen,    color: "bg-blue-50 dark:bg-[#0071E3]/10 text-[#0071E3]" },
              { label: t("users"),            value: adminStats.userCount,      icon: Users,       color: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" },
              { label: t("completionRate"),   value: `${adminStats.completionRate}%`, icon: TrendingUp, color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
              { label: t("certificates"),     value: adminStats.certCount,      icon: Award,       color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                    <p className="text-[28px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-1">{s.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Presence + active this week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PresenceCard />
            <Link href="/dashboard/admin/activity?mode=week" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all group">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
                <Users className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{t("activeThisWeek")}</p>
                <p className="text-[28px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-1">{adminStats.activeThisWeek}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors" />
            </Link>
          </div>

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t("total"),      value: userStats.total,      icon: LayoutList, iconColor: "bg-blue-50 dark:bg-[#0071E3]/10 text-[#0071E3]",                              bar: null },
            { label: t("notStarted"), value: userStats.notStarted, icon: Circle,     iconColor: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73]",                              bar: "bg-[#D2D2D7]" },
            { label: t("inProgress"), value: userStats.inProgress, icon: Clock,      iconColor: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",                            bar: "bg-amber-400" },
            { label: t("completed"),  value: userStats.completed,  icon: CircleCheck, iconColor: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-400" },
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
