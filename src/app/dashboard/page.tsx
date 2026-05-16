import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen, Users, GraduationCap } from "lucide-react";

async function getStats() {
  const [courseCount, userCount] = await Promise.all([
    prisma.course.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  return { courseCount, userCount };
}

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getStats();
  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email ?? "Admin";

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Heading */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">
          Bonjour, {firstName} 👋
        </h1>
        <p className="text-[15px] text-[#6E6E73] mt-1">
          Voici un aperçu de votre plateforme.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Cours actifs",
            value: stats.courseCount,
            icon: BookOpen,
            color: "bg-blue-50 text-[#0071E3]",
          },
          {
            label: "Utilisateurs",
            value: stats.userCount,
            icon: Users,
            color: "bg-purple-50 text-purple-600",
          },
          {
            label: "Formations",
            value: "—",
            icon: GraduationCap,
            color: "bg-green-50 text-green-600",
            sub: "Bientôt disponible",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] text-[#6E6E73] font-medium">{s.label}</p>
                <p className="text-[32px] font-semibold text-[#1D1D1F] leading-none mt-1">
                  {s.value}
                </p>
                {s.sub && (
                  <p className="text-[12px] text-[#ADADB8] mt-1">{s.sub}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
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
          </a>
          <a
            href="/dashboard/settings"
            className="group bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center gap-4 hover:border-[#0071E3]/40 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">Personnaliser</p>
              <p className="text-[13px] text-[#6E6E73]">Logo, nom, bannière</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
