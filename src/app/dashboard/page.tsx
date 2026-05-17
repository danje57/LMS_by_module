import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen, Users, GraduationCap, CircleCheck, Clock, LayoutList, Circle } from "lucide-react";
import Link from "next/link";

async function getAdminStats() {
  const [courseCount, userCount] = await Promise.all([
    prisma.course.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  return { courseCount, userCount };
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

  const completed = certSet.size;
  const inProgress = [...progressSet].filter((id) => !certSet.has(id)).length;
  const notStarted = total - completed - inProgress;

  return { total, completed, inProgress, notStarted };
}

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user.sessionMode === "admin";
  const userId = session?.user.id ?? "";
  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email ?? "";

  const adminStats = isAdmin ? await getAdminStats() : null;
  const userStats = !isAdmin ? await getUserStats(userId) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">
          Bonjour, {firstName} 👋
        </h1>
        <p className="text-[15px] text-[#6E6E73] mt-1">
          {isAdmin ? "Voici un aperçu de votre plateforme." : "Voici l'état de votre formation."}
        </p>
      </div>

      {/* Stats admin */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Cours actifs", value: adminStats.courseCount, icon: BookOpen, color: "bg-blue-50 text-[#0071E3]" },
            { label: "Utilisateurs", value: adminStats.userCount, icon: Users, color: "bg-purple-50 text-purple-600" },
            { label: "Formations", value: "—", icon: GraduationCap, color: "bg-green-50 text-green-600", sub: "Bientôt disponible" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[13px] text-[#6E6E73] font-medium">{s.label}</p>
                  <p className="text-[32px] font-semibold text-[#1D1D1F] leading-none mt-1">{s.value}</p>
                  {s.sub && <p className="text-[12px] text-[#ADADB8] mt-1">{s.sub}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats utilisateur */}
      {!isAdmin && userStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total", value: userStats.total, icon: LayoutList, iconColor: "bg-blue-50 text-[#0071E3]", bar: null },
              { label: "Non commencé", value: userStats.notStarted, icon: Circle, iconColor: "bg-[#F5F5F7] text-[#6E6E73]", bar: "bg-[#0071E3]" },
              { label: "En cours", value: userStats.inProgress, icon: Clock, iconColor: "bg-amber-50 text-amber-500", bar: "bg-amber-400" },
              { label: "Terminé", value: userStats.completed, icon: CircleCheck, iconColor: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-400" },
            ].map((s) => {
              const Icon = s.icon;
              const pct = userStats.total > 0 ? Math.round((s.value / userStats.total) * 100) : 0;
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-[#E5E5EA] p-5 space-y-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6E6E73] font-medium">{s.label}</p>
                    <p className="text-[30px] font-semibold text-[#1D1D1F] leading-none mt-0.5">{s.value}</p>
                  </div>
                  {s.bar && userStats.total > 0 && (
                    <div className="h-1 w-full bg-[#F2F2F7] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions rapides — admin uniquement */}
      {isAdmin && (
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/courses/upload"
              className="group bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#0071E3]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">Ajouter un cours</p>
                <p className="text-[13px] text-[#6E6E73]">Uploader un fichier H5P</p>
              </div>
            </Link>
            <Link
              href="/dashboard/admin/users"
              className="group bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">Gérer les utilisateurs</p>
                <p className="text-[13px] text-[#6E6E73]">Comptes, rôles, équipes</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Accès rapide cours — non-admin */}
      {!isAdmin && (
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">Accès rapide</h2>
          <Link
            href="/dashboard/courses"
            className="group bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#0071E3]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">Mes cours</p>
              <p className="text-[13px] text-[#6E6E73]">Accéder à mes formations assignées</p>
            </div>
          </Link>
        </div>
      )}

    </div>
  );
}
