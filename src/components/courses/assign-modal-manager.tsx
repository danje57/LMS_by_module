"use client";

import { useEffect, useState } from "react";
import { X, Search, Users, UserPlus, Building2, CheckCheck, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type UserRef  = { id: string; name: string | null; email: string; roles: string[] };
type TeamInfo = { id: string; name: string; memberIds: string[] };
type AssignedUser = { userId: string; name: string | null; email: string; dueDate: string | null };

interface Props {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
}

function label(u: { name: string | null; email: string }) {
  return u.name ?? u.email;
}

export function AssignModalManager({ courseId, courseTitle, onClose }: Props) {
  const t = useTranslations("assignment");
  const [allUsers, setAllUsers]         = useState<UserRef[]>([]);
  const [teams, setTeams]               = useState<TeamInfo[]>([]);
  const [callerTeams, setCallerTeams]   = useState<{ id: string; name: string }[]>([]);
  const [teamContext, setTeamContext]    = useState<string | null>(null);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [alreadyAssigned, setAlreadyAssigned] = useState<Set<string>>(new Set());
  const [dueDates, setDueDates]         = useState<Record<string, string>>({});
  const [commonDueDate, setCommonDueDate] = useState<string>("");
  const [search, setSearch]             = useState("");
  const [tab, setTab]                   = useState<"teams" | "users">("teams");
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    async function load() {
      const [ctxRes, assignedRes] = await Promise.all([
        fetch("/api/assign/context"),
        fetch(`/api/courses/${courseId}/assign`),
      ]);
      const ctx  = await ctxRes.json();
      const assigned: AssignedUser[] = await assignedRes.json();

      setAllUsers(ctx.users);
      setTeams(ctx.teams);
      setCallerTeams(ctx.callerTeams);
      if (ctx.callerTeams.length === 1) setTeamContext(ctx.callerTeams[0].id);

      const assignedIds = new Set(assigned.map((a: AssignedUser) => a.userId));
      setSelected(assignedIds);
      setAlreadyAssigned(assignedIds);
      const dates: Record<string, string> = {};
      assigned.forEach((a: AssignedUser) => { if (a.dueDate) dates[a.userId] = a.dueDate.slice(0, 10); });
      setDueDates(dates);
      setLoading(false);
    }
    load();
  }, [courseId]);

  function toggleUser(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); }
      else { n.add(id); if (commonDueDate) setDueDates((d) => ({ ...d, [id]: commonDueDate })); }
      return n;
    });
  }

  function toggleTeam(team: TeamInfo) {
    const ids = team.memberIds;
    const allIn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => {
        if (allIn) { n.delete(id); }
        else { n.add(id); }
      });
      return n;
    });
    if (!allIn && commonDueDate) {
      setDueDates((prev) => {
        const n = { ...prev };
        ids.forEach((id) => { n[id] = commonDueDate; });
        return n;
      });
    }
  }

  function applyCommonDate(date: string) {
    setCommonDueDate(date);
    if (date) {
      setDueDates((prev) => {
        const n = { ...prev };
        selected.forEach((id) => { n[id] = date; });
        return n;
      });
    }
  }

  async function handleSave() {
    if (callerTeams.length > 1 && !teamContext) return; // force context selection
    setSaving(true);
    await fetch(`/api/courses/${courseId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: [...selected].map((userId) => ({ userId, dueDate: dueDates[userId] ?? null })),
        teamContextId: teamContext,
      }),
    });
    setSaving(false);
    onClose();
  }

  const filteredUsers = allUsers.filter((u) =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const needsContext = callerTeams.length > 1 && !teamContext;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-5 h-5 text-[#0071E3]" />
              <p className="text-[15px] font-semibold text-[#1D1D1F]">{t("assignCourse")}</p>
            </div>
            <p className="text-[12px] text-[#6E6E73] mt-0.5 ml-7 line-clamp-1">{courseTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
            <X className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>

        {/* Team context selector (only if multiple teams) */}
        {callerTeams.length > 1 && (
          <div className="px-6 py-3 border-b border-[#E5E5EA] bg-amber-50 shrink-0">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-amber-800">Contexte équipe</p>
                <p className="text-[12px] text-amber-600">Ces affectations seront rattachées à l&apos;équipe choisie.</p>
              </div>
              <select
                value={teamContext ?? ""}
                onChange={(e) => setTeamContext(e.target.value || null)}
                className="h-9 px-3 rounded-xl border border-amber-200 bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
              >
                <option value="">— Choisir —</option>
                {callerTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Deadline commune */}
            <div className="px-6 pt-4 shrink-0">
              <div className="flex items-center gap-3 p-3 bg-[#F5F5F7] rounded-xl">
                <CalendarDays className="w-4 h-4 text-[#6E6E73] shrink-0" />
                <span className="text-[13px] text-[#1D1D1F] font-medium flex-1">{t("deadline")}</span>
                <input
                  type="date"
                  value={commonDueDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => applyCommonDate(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-[#D2D2D7] bg-white text-[12px] outline-none focus:border-[#0071E3] transition-all"
                />
                {commonDueDate && (
                  <button
                    onClick={() => { setCommonDueDate(""); setDueDates({}); }}
                    className="text-[11px] text-[#ADADB8] hover:text-[#1D1D1F] transition-colors"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#ADADB8] mt-1.5 ml-1">S'applique à tous les sélectionnés · modifiable individuellement dans l'onglet Individuel</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 shrink-0">
              {(["teams", "users"] as const).map((tabKey) => (
                <button key={tabKey} onClick={() => setTab(tabKey)}
                  className={cn("px-4 py-2 rounded-xl text-[13px] font-medium transition-all",
                    tab === tabKey ? "bg-[#0071E3] text-white" : "text-[#6E6E73] hover:bg-[#F5F5F7]"
                  )}>
                  {tabKey === "teams" ? <><Users className="w-3.5 h-3.5 inline mr-1.5" />{t("teams")}</> : t("individual")}
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-[12px] text-[#6E6E73] self-center">{t("selectedUsers", { count: selected.size })}</span>
            </div>

            {/* Search */}
            <div className="px-6 py-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
                <input
                  type="text"
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#D2D2D7] text-[13px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              {tab === "teams" ? (
                teams
                  .filter((tm) => tm.name.toLowerCase().includes(search.toLowerCase()))
                  .map((team) => {
                    const teamUsers = allUsers.filter((u) => team.memberIds.includes(u.id));
                    const allIn = teamUsers.length > 0 && teamUsers.every((u) => selected.has(u.id));
                    const someIn = teamUsers.some((u) => selected.has(u.id));
                    return (
                      <div key={team.id} className="rounded-xl border border-[#E5E5EA] overflow-hidden">
                        <button
                          onClick={() => toggleTeam(team)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F7] transition-colors text-left"
                        >
                          <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                            allIn ? "bg-[#0071E3] border-[#0071E3]" : someIn ? "border-[#0071E3] bg-[#0071E3]/10" : "border-[#D2D2D7]"
                          )}>
                            {allIn && <CheckCheck className="w-3 h-3 text-white" />}
                          </div>
                          <Users className="w-4 h-4 text-[#6E6E73]" />
                          <span className="text-[14px] font-medium text-[#1D1D1F] flex-1">{team.name}</span>
                          <span className="text-[12px] text-[#ADADB8]">{teamUsers.length} membres</span>
                        </button>
                        {teamUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-3 px-4 py-2 bg-[#FAFAFA] border-t border-[#F2F2F7] cursor-pointer hover:bg-[#F5F5F7] transition-colors">
                            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleUser(u.id)}
                              className="w-4 h-4 rounded accent-[#0071E3]" />
                            <span className="text-[13px] text-[#1D1D1F] flex-1">{label(u)}</span>
                            {alreadyAssigned.has(u.id) && (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Déjà assigné</span>
                            )}
                            <span className="text-[11px] text-[#ADADB8]">{u.email}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })
              ) : (
                filteredUsers.map((u) => (
                  <label key={u.id} className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors",
                    alreadyAssigned.has(u.id) ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-[#F5F5F7]"
                  )}>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 rounded accent-[#0071E3]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#1D1D1F]">{label(u)}</p>
                        {alreadyAssigned.has(u.id) && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">Déjà assigné</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#ADADB8] truncate">{u.email}</p>
                    </div>
                    {selected.has(u.id) && (
                      <input
                        type="date"
                        value={dueDates[u.id] ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDueDates((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        min={alreadyAssigned.has(u.id) ? undefined : new Date().toISOString().slice(0, 10)}
                        title={alreadyAssigned.has(u.id) ? "Modifier la deadline existante" : "Définir une deadline"}
                        className={cn(
                          "h-8 px-2 rounded-lg border text-[12px] outline-none transition-all",
                          alreadyAssigned.has(u.id)
                            ? "border-emerald-200 bg-emerald-50 focus:border-emerald-400"
                            : "border-[#D2D2D7] bg-white focus:border-[#0071E3]"
                        )}
                      />
                    )}
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#E5E5EA] shrink-0">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors">
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || needsContext}
            title={needsContext ? "Choisissez un contexte équipe" : undefined}
            className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? t("saving") : needsContext ? "Choisir une équipe d'abord" : t("assign")}
          </button>
        </div>
      </div>
    </div>
  );
}
