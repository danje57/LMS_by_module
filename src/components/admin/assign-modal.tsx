"use client";

import { useEffect, useState } from "react";
import { X, Search, UserCheck, Calendar, Users, UserPlus, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type UserRef = { id: string; name: string | null; email: string; roles: string[] };
type TeamRef = { id: string; name: string; members: UserRef[] };
type AssignedUser = { userId: string; name: string | null; email: string; dueDate: string | null };

const OPERATIONAL_ROLES = ["manager", "creator", "learner"];
function isAssignable(roles: string[]) {
  return roles.some((r) => OPERATIONAL_ROLES.includes(r));
}

interface AssignModalProps {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
}

function label(u: { name: string | null; email: string }) {
  return u.name ?? u.email;
}

export function AssignModal({ courseId, courseTitle, onClose }: AssignModalProps) {
  const t = useTranslations("assignment");
  const [allUsers, setAllUsers] = useState<UserRef[]>([]);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"teams" | "users">("teams");

  useEffect(() => {
    async function load() {
      const [usersRes, teamsRes, assignedRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/teams"),
        fetch(`/api/admin/courses/${courseId}/assignments`),
      ]);
      const users: UserRef[] = await usersRes.json();
      const teamsData: TeamRef[] = await teamsRes.json();
      const assignedData: AssignedUser[] = await assignedRes.json();

      // Exclure les purs admins (sans rôle opérationnel)
      const assignableUsers = users.filter((u) => isAssignable(u.roles));
      const assignableIds = new Set(assignableUsers.map((u) => u.id));

      setAllUsers(assignableUsers);
      // Filtrer aussi les membres des équipes
      setTeams(teamsData.map((t) => ({
        ...t,
        members: t.members.filter((m) => assignableIds.has(m.id)),
      })));
      setSelected(new Set(assignedData.map((a) => a.userId)));
      const dates: Record<string, string> = {};
      assignedData.forEach((a) => { if (a.dueDate) dates[a.userId] = a.dueDate.slice(0, 10); });
      setDueDates(dates);
      setLoading(false);
    }
    load();
  }, [courseId]);

  /* ---- Sélection ---- */
  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  function toggleTeam(team: TeamRef) {
    const memberIds = team.members.map((m) => m.id);
    const allIn = memberIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allIn) memberIds.forEach((id) => next.delete(id));
      else memberIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allUsers.map((u) => u.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  /* ---- Save ---- */
  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/courses/${courseId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: [...selected].map((userId) => ({
          userId,
          dueDate: dueDates[userId] ?? null,
        })),
      }),
    });
    setSaving(false);
    onClose();
  }

  const filteredUsers = allUsers.filter((u) =>
    label(u).toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = allUsers.length > 0 && allUsers.every((u) => selected.has(u.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E5EA] shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{t("assignCourse")}</p>
            <p className="text-[13px] text-[#6E6E73] mt-0.5 line-clamp-1">{courseTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
            <X className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>

        {/* Barre actions rapides */}
        <div className="px-6 py-3 border-b border-[#F5F5F7] flex items-center justify-between shrink-0">
          <div className="flex gap-1.5 bg-[#F5F5F7] rounded-xl p-1">
            <button
              onClick={() => setTab("teams")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                tab === "teams" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#6E6E73] hover:text-[#1D1D1F]")}
            >
              <Users className="w-3.5 h-3.5" />
              {t("teams")}
            </button>
            <button
              onClick={() => setTab("users")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                tab === "users" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#6E6E73] hover:text-[#1D1D1F]")}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {t("individual")}
            </button>
          </div>
          <button
            onClick={allSelected ? deselectAll : selectAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#D2D2D7] text-[12px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#ADADB8] disabled:opacity-40 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {allSelected ? t("deselectAll") : t("assignAll")}
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === "teams" ? (
            /* --- Onglet Équipes --- */
            teams.length === 0 ? (
              <p className="text-[13px] text-[#ADADB8] text-center py-10">{t("noTeams")}</p>
            ) : teams.map((team) => {
              const memberIds = team.members.map((m) => m.id);
              const allIn = memberIds.length > 0 && memberIds.every((id) => selected.has(id));
              const someIn = memberIds.some((id) => selected.has(id));
              return (
                <div
                  key={team.id}
                  onClick={() => toggleTeam(team)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                    allIn ? "border-[#0071E3]/30 bg-blue-50/40" : someIn ? "border-amber-200 bg-amber-50/30" : "border-[#E5E5EA] hover:border-[#D2D2D7]"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                    allIn ? "bg-[#0071E3] border-[#0071E3]" : someIn ? "bg-amber-400 border-amber-400" : "border-[#D2D2D7]"
                  )}>
                    {(allIn || someIn) && <UserCheck className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">{team.name}</p>
                    <p className="text-[11px] text-[#6E6E73]">
                      {team.members.length} membre{team.members.length !== 1 ? "s" : ""}
                      {someIn && !allIn && ` · ${memberIds.filter((id) => selected.has(id)).length} sélectionné${memberIds.filter((id) => selected.has(id)).length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {allIn && <span className="text-[11px] font-medium text-[#0071E3]">Tous</span>}
                </div>
              );
            })
          ) : (
            /* --- Onglet Individuel --- */
            <>
              <div className="relative mb-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
                <input
                  type="text"
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#D2D2D7] text-[13px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
                />
              </div>
              {filteredUsers.length === 0 ? (
                <p className="text-[13px] text-[#ADADB8] text-center py-8">{t("noUserFound")}</p>
              ) : filteredUsers.map((user) => {
                const isSelected = selected.has(user.id);
                return (
                  <div key={user.id} className={cn("rounded-xl border transition-all",
                    isSelected ? "border-[#0071E3]/30 bg-blue-50/40" : "border-[#E5E5EA] hover:border-[#D2D2D7]"
                  )}>
                    <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => toggleUser(user.id)}>
                      <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "bg-[#0071E3] border-[#0071E3]" : "border-[#D2D2D7]"
                      )}>
                        {isSelected && <UserCheck className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{label(user)}</p>
                        {user.name && <p className="text-[11px] text-[#6E6E73] truncate">{user.email}</p>}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2 px-3 pb-2.5">
                        <Calendar className="w-3.5 h-3.5 text-[#ADADB8] shrink-0" />
                        <input
                          type="date"
                          value={dueDates[user.id] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setDueDates((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          className="h-7 px-2 rounded-lg border border-[#D2D2D7] text-[12px] outline-none focus:border-[#0071E3] transition-all"
                        />
                        <span className="text-[11px] text-[#ADADB8]">{t("deadline")}</span>
                        {dueDates[user.id] && (
                          <button onClick={(e) => { e.stopPropagation(); setDueDates((prev) => { const n = { ...prev }; delete n[user.id]; return n; }); }} className="text-[11px] text-[#ADADB8] hover:text-red-400">✕</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E5EA] flex items-center justify-between shrink-0">
          <p className="text-[13px] text-[#6E6E73]">
            {t("selectedUsers", { count: selected.size })}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[#D2D2D7] text-[13px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors">
              {t("cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="h-9 px-4 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium disabled:opacity-50 transition-colors">
              {saving ? t("saving") : t("assign")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
