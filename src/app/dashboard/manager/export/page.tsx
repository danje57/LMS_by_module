import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Download, FileText, ClipboardList, Users } from "lucide-react";

export default async function ManagerExportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
  });
  if (!role && session.user.sessionMode !== "admin") redirect("/dashboard");

  const teams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    include: { members: { select: { userId: true } } },
  });

  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          Exports CSV
        </h1>
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          Données de vos équipes — reporting RH et conformité
        </p>
      </div>

      {/* Résumé équipes */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {teams.length} équipe{teams.length > 1 ? "s" : ""} — {totalMembers} membre{totalMembers > 1 ? "s" : ""}
          </p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
            {teams.map((t) => t.name).join(", ")}
          </p>
        </div>
      </div>

      {/* Boutons export */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
        <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Fichiers disponibles</h2>
        <div className="space-y-3">
          <a
            href="/api/admin/export?type=progress"
            download
            className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Progressions</p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
                Avancement par cours, statut, dates — limité à vos équipes
              </p>
            </div>
            <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
          </a>

          <a
            href="/api/admin/export?type=quiz"
            download
            className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Résultats quiz</p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
                Scores, seuils, réussite/échec par tentative — limité à vos équipes
              </p>
            </div>
            <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}
