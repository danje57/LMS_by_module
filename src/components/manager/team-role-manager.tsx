"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { UserCog, Loader2 } from "lucide-react";

export type TeamMemberRow = {
  id: string;
  name: string | null;
  email: string;
  roles: string[];
};

export type ManagedTeam = {
  id: string;
  name: string;
  members: TeamMemberRow[];
};

interface TeamRoleManagerProps {
  teams: ManagedTeam[];
  currentUserId: string;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin:   "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
    manager: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
    creator: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
    learner: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  const labels: Record<string, string> = {
    admin: "Admin", manager: "Manager", creator: "Créateur", learner: "Apprenant",
  };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", colors[role] ?? "bg-[#F5F5F7] text-[#6E6E73]")}>
      {labels[role] ?? role}
    </span>
  );
}

export function TeamRoleManager({ teams, currentUserId }: TeamRoleManagerProps) {
  const t = useTranslations("managerTeam");
  const [memberRoles, setMemberRoles] = useState<Record<string, string[]>>(
    Object.fromEntries(teams.flatMap((team) => team.members.map((m) => [m.id, m.roles])))
  );
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#6E6E73] dark:text-[#8E8E93]">
        <UserCog className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-[15px]">{t("noTeams")}</p>
      </div>
    );
  }

  function canManage(roles: string[]): boolean {
    return !roles.includes("manager");
  }

  async function handleToggle(memberId: string, action: "promote" | "demote") {
    setError(null);
    setLoadingId(memberId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/manager/team-members/${memberId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? t(action === "promote" ? "errorPromote" : "errorDemote"));
        } else {
          const data = await res.json();
          setMemberRoles((prev) => ({ ...prev, [memberId]: data.roles }));
        }
      } catch {
        setError(t(action === "promote" ? "errorPromote" : "errorDemote"));
      } finally {
        setLoadingId(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-4 py-2.5 rounded-xl">
          {error}
        </div>
      )}

      {teams.map((team) => (
        <div key={team.id}>
          <h2 className="text-[13px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide mb-3">
            {team.name}
          </h2>

          {team.members.length === 0 ? (
            <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] py-4">{t("noMembers")}</p>
          ) : (
            <div className="bg-white dark:bg-[#111114] rounded-2xl border border-[#E5E5EA] dark:border-[#2C2C30] overflow-hidden">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#E5E5EA] dark:border-[#2C2C30]">
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide w-1/2">{t("colMember")}</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">{t("colRole")}</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">{t("colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((member, i) => {
                    const roles = memberRoles[member.id] ?? member.roles;
                    const isCreator = roles.includes("creator");
                    const manageable = canManage(roles) && member.id !== currentUserId;
                    const isLoading = loadingId === member.id && pending;

                    return (
                      <tr
                        key={member.id}
                        className={cn(
                          "transition-colors",
                          i < team.members.length - 1 && "border-b border-[#E5E5EA] dark:border-[#2C2C30]",
                          "hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20]"
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{member.name ?? "—"}</p>
                          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{member.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {roles.map((r) => <RoleBadge key={r} role={r} />)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!manageable ? (
                            <span className="text-[12px] text-[#ADADB8] dark:text-[#636366]">{t("cannotManage")}</span>
                          ) : isLoading ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {t("processing")}
                            </span>
                          ) : isCreator ? (
                            <button
                              onClick={() => handleToggle(member.id, "demote")}
                              className="text-[13px] font-medium text-red-600 dark:text-red-400 hover:underline"
                            >
                              {t("demote")}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggle(member.id, "promote")}
                              className="text-[13px] font-medium text-[#0071E3] hover:underline"
                            >
                              {t("promote")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
