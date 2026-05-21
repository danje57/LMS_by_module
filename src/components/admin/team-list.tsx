"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp, X, Check, Crown, UserMinus, UserPlus, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type UserRef = { id: string; name: string | null; email: string };
type TeamRow = { id: string; name: string; manager: UserRef | null; members: UserRef[] };

interface TeamListProps {
  initialTeams: TeamRow[];
  allUsers: UserRef[];
}

type SortField = "name" | "members";
type SortDir = "asc" | "desc";

export function TeamList({ initialTeams, allUsers }: TeamListProps) {
  const t = useTranslations("teams");
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const sorted = [...teams].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return mul * a.name.localeCompare(b.name, "fr");
    return mul * (a.members.length - b.members.length);
  });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TeamRow | null>(null);
  const [loading, setLoading] = useState(false);

  function label(u: UserRef) { return u.name ?? u.email; }

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setTeams((prev) => [...prev, json]);
    setNewName("");
    setCreating(false);
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return;
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name: json.name } : t)));
    setEditingId(null);
  }

  async function handleSetManager(teamId: string, managerId: string | null) {
    const res = await fetch(`/api/admin/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId }),
    });
    const json = await res.json();
    if (!res.ok) return;
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, manager: json.manager, members: json.members } : t)));
  }

  async function handleAddMember(teamId: string, userId: string) {
    const res = await fetch(`/api/admin/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const user = await res.json();
    if (!res.ok) return;
    setTeams((prev) => prev.map((t) =>
      t.id === teamId ? { ...t, members: [...t.members, user] } : t
    ));
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    const res = await fetch(`/api/admin/teams/${teamId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    setTeams((prev) => prev.map((t) =>
      t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== userId) } : t
    ));
  }

  async function handleDelete(team: TeamRow) {
    setLoading(true);
    const res = await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) return;
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      {/* Bouton créer */}
      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder={t("teamNamePlaceholder")}
            className="flex-1 h-10 px-3 rounded-xl border border-[#0071E3] text-[14px] outline-none ring-3 ring-[#0071E3]/20"
          />
          <button onClick={handleCreate} disabled={loading} className="h-10 px-4 rounded-xl bg-[#0071E3] text-white text-[13px] font-medium disabled:opacity-50">
            {t("save")}
          </button>
          <button onClick={() => setCreating(false)} className="h-10 px-3 rounded-xl border border-[#D2D2D7] text-[#6E6E73]">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 h-10 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("newTeam")}
        </button>
      )}

      {/* Liste équipes */}
      {teams.length === 0 && !creating && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">{t("noTeams")}</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">{t("createFirst")}</p>
        </div>
      )}

      {/* Tri */}
      {teams.length > 1 && (
        <div className="flex gap-2">
          {([["name", t("rename")], ["members", t("members")]] as [SortField, string][]).map(([field, lbl]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[13px] font-medium transition-all",
                sortField === field
                  ? "bg-[#0071E3] border-[#0071E3] text-white"
                  : "bg-white border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {lbl}
              {sortField === field && <span className="text-[11px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((team) => {
          const isOpen = expanded === team.id;
          const availableToAdd = allUsers.filter((u) => !team.members.some((m) => m.id === u.id) && u.id !== team.manager?.id);
          const managers = allUsers.filter((u) =>
            /* on propose tous les users comme managers potentiels */ true
          );

          return (
            <div key={team.id} className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
              {/* Header équipe */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <Users className="w-4.5 h-4.5 text-purple-500" style={{ width: 18, height: 18 }} />
                </div>

                {/* Nom — mode édition inline */}
                {editingId === team.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(team.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 h-8 px-2.5 rounded-lg border border-[#0071E3] text-[14px] outline-none ring-2 ring-[#0071E3]/20"
                    />
                    <button onClick={() => handleRename(team.id)} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7]"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1D1D1F]">{team.name}</p>
                    <p className="text-[12px] text-[#6E6E73] mt-0.5">
                      {t("memberCount", { count: team.members.length })}
                      {team.manager ? ` · ${t("manager")} : ${label(team.manager)}` : ` · ${t("noManager")}`}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {editingId !== team.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingId(team.id); setEditName(team.name); }}
                      className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                      title={t("rename")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(team)}
                      className="p-2 rounded-lg text-[#6E6E73] hover:bg-red-50 hover:text-red-500 transition-colors"
                      title={t("delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpanded(isOpen ? null : team.id)}
                      className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Panneau étendu */}
              {isOpen && (
                <div className="border-t border-[#F5F5F7] px-5 py-4 space-y-5 bg-[#FAFAFA]">

                  {/* Manager */}
                  <div className="space-y-2">
                    <p className="text-[12px] font-semibold text-[#6E6E73] uppercase tracking-wide">{t("manager")}</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={team.manager?.id ?? ""}
                        onChange={(e) => handleSetManager(team.id, e.target.value || null)}
                        className="flex-1 h-9 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
                      >
                        <option value="">{t("noManager")}</option>
                        {managers.map((u) => (
                          <option key={u.id} value={u.id}>{label(u)}</option>
                        ))}
                      </select>
                      {team.manager && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                          <Crown className="w-3 h-3" />
                          {t("manager")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Membres */}
                  <div className="space-y-2">
                    <p className="text-[12px] font-semibold text-[#6E6E73] uppercase tracking-wide">{t("members")}</p>

                    {/* Ajouter un membre */}
                    {availableToAdd.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) { handleAddMember(team.id, e.target.value); e.target.value = ""; } }}
                          className="flex-1 h-9 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
                        >
                          <option value="">{t("addMember")}</option>
                          {availableToAdd.map((u) => (
                            <option key={u.id} value={u.id}>{label(u)}</option>
                          ))}
                        </select>
                        <UserPlus className="w-4 h-4 text-[#ADADB8] shrink-0" />
                      </div>
                    )}

                    {/* Liste membres */}
                    {team.members.length === 0 ? (
                      <p className="text-[13px] text-[#ADADB8] italic">{t("noMembers")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {team.members.map((m) => {
                          const isManager = m.id === team.manager?.id;
                          return (
                            <div key={m.id} className="flex items-center justify-between bg-white rounded-xl border border-[#E5E5EA] px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isManager && <Crown className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                                <div>
                                  <p className="text-[13px] font-medium text-[#1D1D1F]">{label(m)}</p>
                                  {m.name && <p className="text-[11px] text-[#6E6E73]">{m.email}</p>}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(team.id, m.id)}
                                disabled={isManager}
                                className="p-1.5 rounded-lg text-[#ADADB8] hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title={isManager ? "Retirer le manager depuis le sélecteur ci-dessus" : t("remove")}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1D1D1F]">{t("deleteTeam")}</p>
                <p className="text-[13px] text-[#6E6E73]">{deleteTarget.name}</p>
              </div>
            </div>
            <p className="text-[13px] text-[#6E6E73]">
              {t("deleteTeamDesc")}
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors">
                {t("cancel")}
              </button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={loading} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-medium disabled:opacity-50 transition-colors">
                {loading ? t("saving") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
