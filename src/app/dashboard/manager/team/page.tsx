import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { TeamRoleManager } from "@/components/manager/team-role-manager";
import type { ManagedTeam } from "@/components/manager/team-role-manager";

export default async function ManagerTeamPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.sessionMode === "admin") redirect("/dashboard/admin/users");

  // Strict manager check — creators cannot access this page
  const managerRole = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: "manager" } },
  });
  if (!managerRole) redirect("/dashboard");

  const t = await getTranslations("managerTeam");

  const rawTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    orderBy: { name: "asc" },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              roles: { include: { role: true } },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  const teams: ManagedTeam[] = rawTeams.map((team) => ({
    id: team.id,
    name: team.name,
    members: team.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      roles: m.user.roles.map((r) => r.role.name),
    })),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("title")}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      <TeamRoleManager teams={teams} currentUserId={session.user.id} />
    </div>
  );
}
