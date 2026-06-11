import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeamList } from "@/components/admin/team-list";
import { getTranslations } from "next-intl/server";

async function getData() {
  const [teams, users] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, roles: { include: { role: { select: { name: true } } } } } } } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return {
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      manager: t.manager,
      members: t.members.map((m) => ({
        ...m.user,
        roles: m.user.roles.map((r) => r.role.name),
      })),
    })),
    users,
  };
}

export default async function AdminTeamsPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { teams, users } = await getData();
  const t = await getTranslations("teams");
  const tNav = await getTranslations("nav");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{tNav("teams")}</h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("memberCount", { count: teams.length })}
        </p>
      </div>
      <TeamList initialTeams={teams} allUsers={users} />
    </div>
  );
}
