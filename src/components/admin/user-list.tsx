"use client";

import { useState } from "react";
import { RoleType } from "@prisma/client";
import {
  Search, Plus, Pencil, Trash2, ShieldCheck,
  UserCheck, UserX, X, Eye, EyeOff, Crown, Upload, Layers, KeyRound, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportModal } from "@/components/admin/import-modal";
import { validatePassword, RULES } from "@/lib/password";
import { useTranslations } from "next-intl";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: RoleType[];
  teams: { id: string; name: string }[];
};

const ALL_ROLES: RoleType[] = ["admin", "manager", "creator", "learner"];

const ROLE_LABELS: Record<RoleType, string> = {
  admin: "Admin",
  manager: "Manager",
  creator: "Créateur",
  learner: "Apprenant",
};

const ROLE_COLORS: Record<RoleType, string> = {
  admin: "bg-red-50 text-red-600",
  manager: "bg-purple-50 text-purple-600",
  creator: "bg-amber-50 text-amber-600",
  learner: "bg-blue-50 text-blue-600",
};

const ROLE_COLORS_ACTIVE: Record<RoleType, string> = {
  admin: "bg-red-500 text-white border-red-500",
  manager: "bg-purple-500 text-white border-purple-500",
  creator: "bg-amber-500 text-white border-amber-500",
  learner: "bg-blue-500 text-white border-blue-500",
};

const ROLE_COLORS_IMPLIED: Record<RoleType, string> = {
  admin: "",
  manager: "bg-purple-100 text-purple-500 border-purple-200",
  creator: "bg-amber-100 text-amber-500 border-amber-200",
  learner: "bg-blue-100 text-blue-400 border-blue-200",
};

type OperationalRole = "manager" | "creator" | "learner" | "none";

function getImpliedRoles(op: OperationalRole): RoleType[] {
  if (op === "manager") return ["manager", "creator", "learner"];
  if (op === "creator") return ["creator", "learner"];
  if (op === "learner") return ["learner"];
  return [];
}

function getOperationalRole(roles: RoleType[]): OperationalRole {
  if (roles.includes("manager")) return "manager";
  if (roles.includes("creator")) return "creator";
  if (roles.includes("learner")) return "learner";
  return "none";
}

function buildRoles(isAdmin: boolean, op: OperationalRole): RoleType[] {
  const base = getImpliedRoles(op);
  return isAdmin ? ["admin", ...base] : base;
}

type TeamRef = { id: string; name: string; managerId: string | null };

interface UserListProps {
  initialUsers: UserRow[];
  currentUserId: string;
  teams: TeamRef[];
}

export function UserList({ initialUsers, currentUserId, teams: initialTeams }: UserListProps) {
  const t = useTranslations("users");
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [teams, setTeams] = useState<TeamRef[]>(initialTeams);

  function getManagedTeamId(userId: string): string | null {
    return teams.find((t) => t.managerId === userId)?.id ?? null;
  }

  async function updateManagedTeam(userId: string, newTeamId: string | null, oldTeamId: string | null) {
    if (oldTeamId === newTeamId) return;
    if (oldTeamId) {
      await fetch(`/api/admin/teams/${oldTeamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: null }),
      });
      setTeams((prev) => prev.map((t) => t.id === oldTeamId ? { ...t, managerId: null } : t));
    }
    if (newTeamId) {
      await fetch(`/api/admin/teams/${newTeamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: userId }),
      });
      setTeams((prev) => prev.map((t) => t.id === newTeamId ? { ...t, managerId: userId } : t));
    }
  }
  const PAGE_SIZES = [0, 5, 10, 20, 50] as const;
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<RoleType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [groupByTeam, setGroupByTeam] = useState(false);

  function resetPage() { setPage(1); }
  const [modalImport, setModalImport] = useState(false);

  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<{ password: string; emailSent: boolean; userName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.roles.includes(filterRole);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" ? u.isActive : !u.isActive);
    const matchTeam =
      filterTeam === "all" ||
      (filterTeam === "none" ? u.teams.length === 0 : u.teams.some((t) => t.id === filterTeam));
    return matchSearch && matchRole && matchStatus && matchTeam;
  });

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleCreate(data: {
    name: string; email: string; password: string; roles: RoleType[]; managedTeamId: string | null;
  }) {
    setLoading(true);
    setError("");
    const { managedTeamId, ...userData } = data;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    const json = await res.json();
    if (!res.ok) { setLoading(false); setError(json.error ?? "Erreur"); return; }
    setUsers((prev) => [{ ...json, teams: [] }, ...prev]);
    await updateManagedTeam(json.id, managedTeamId, null);
    setLoading(false);
    setModalCreate(false);
  }

  async function handleEdit(id: string, data: {
    name?: string; email?: string; password?: string; roles?: RoleType[]; isActive?: boolean; managedTeamId: string | null;
  }) {
    setLoading(true);
    setError("");
    const { managedTeamId, ...userData } = data;
    const oldTeamId = getManagedTeamId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    const json = await res.json();
    if (!res.ok) { setLoading(false); setError(json.error ?? "Erreur"); return; }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...json, teams: u.teams } : u)));
    await updateManagedTeam(id, managedTeamId, oldTeamId);
    setLoading(false);
    setModalEdit(null);
  }

  async function handleToggleActive(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (!res.ok) return;
    const json = await res.json();
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...json, teams: u.teams } : u)));
  }

  async function handleDelete(user: UserRow) {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) return;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setDeleteTarget(null);
  }

  async function handleResetPassword(user: UserRow) {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setResetTarget(null);
    setResetResult({ password: json.password, emailSent: json.emailSent, userName: user.name ?? user.email });
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <div className="flex gap-1.5 bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl p-1">
          {(["all", "active", "inactive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setFilterStatus(v); resetPage(); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterStatus === v ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              )}
            >
              {v === "all" ? t("all") : v === "active" ? t("active") : t("inactive")}
            </button>
          ))}
        </div>

        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value as RoleType | "all"); resetPage(); }}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">{t("allRoles")}</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        <select
          value={filterTeam}
          onChange={(e) => { setFilterTeam(e.target.value); resetPage(); }}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">{t("allTeams")}</option>
          <option value="none">{t("noTeam")}</option>
          {initialTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          onClick={() => setGroupByTeam((v) => !v)}
          title={t("group")}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-4 border text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap",
            groupByTeam
              ? "bg-[#0071E3] border-[#0071E3] text-white"
              : "bg-white dark:bg-[#1C1C1E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#0071E3] hover:text-[#0071E3]"
          )}
        >
          <Layers className="w-4 h-4" />
          {t("group")}
        </button>

        <button
          onClick={() => setModalImport(true)}
          className="inline-flex items-center gap-2 h-10 px-4 bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3] hover:text-[#0071E3] text-[#1D1D1F] dark:text-[#F5F5F7] text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          {t("import")}
        </button>

        <button
          onClick={() => { setModalCreate(true); setError(""); }}
          className="inline-flex items-center gap-2 h-10 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t("create")}
        </button>
      </div>

      {/* Barre au-dessus du tableau */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
          {filtered.length} utilisateur{filtered.length !== 1 ? "s" : ""}
        </p>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
          className="h-8 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all cursor-pointer"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s === 0 ? "Tous" : `${s} / page`}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("noUserFound")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Utilisateur</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Rôles</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Équipe</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
              {groupByTeam
                ? (() => {
                    const groups: { teamId: string | null; teamName: string; users: UserRow[] }[] = [];
                    const teamOrder = initialTeams.map((t) => t.id);
                    const byTeam = new Map<string, UserRow[]>();
                    const noTeam: UserRow[] = [];
                    for (const u of paginated) {
                      if (u.teams.length === 0) {
                        noTeam.push(u);
                      } else {
                        for (const t of u.teams) {
                          if (!byTeam.has(t.id)) byTeam.set(t.id, []);
                          byTeam.get(t.id)!.push(u);
                        }
                      }
                    }
                    for (const id of teamOrder) {
                      const t = initialTeams.find((x) => x.id === id)!;
                      const members = byTeam.get(id);
                      if (members && members.length > 0) groups.push({ teamId: id, teamName: t.name, users: members });
                    }
                    if (noTeam.length > 0) groups.push({ teamId: null, teamName: t("noTeam"), users: noTeam });

                    return groups.flatMap(({ teamId, teamName, users: gUsers }) => [
                      <tr key={`group-${teamId ?? "none"}`} className="bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                        <td colSpan={5} className="px-5 py-2">
                          <span className="text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">
                            {teamName}
                            <span className="ml-2 font-normal normal-case">({gUsers.length})</span>
                          </span>
                        </td>
                      </tr>,
                      ...gUsers.map((user) => <UserTableRow key={user.id} user={user} currentUserId={currentUserId} onToggle={handleToggleActive} onEdit={(u) => { setModalEdit(u); setError(""); }} onDelete={setDeleteTarget} onReset={setResetTarget} />),
                    ]);
                  })()
                : paginated.map((user) => (
                    <UserTableRow key={user.id} user={user} currentUserId={currentUserId} onToggle={handleToggleActive} onEdit={(u) => { setModalEdit(u); setError(""); }} onDelete={setDeleteTarget} onReset={setResetTarget} />
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} sur {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-colors flex items-center justify-center"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-[13px] text-[#ADADB8]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-[13px] font-medium transition-colors",
                      page === p
                        ? "bg-[#0071E3] text-white"
                        : "border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                    )}
                  >{p}</button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-colors flex items-center justify-center"
            >›</button>
          </div>
        </div>
      )}

      {/* Modal création */}
      {modalCreate && (
        <UserModal
          title={t("createUser")}
          teams={teams}
          onClose={() => setModalCreate(false)}
          onSubmit={(data) => handleCreate(data)}
          loading={loading}
          error={error}
        />
      )}

      {/* Modal édition */}
      {modalEdit && (
        <UserModal
          title={t("editUser")}
          initial={modalEdit}
          initialManagedTeamId={getManagedTeamId(modalEdit.id)}
          teams={teams}
          onClose={() => setModalEdit(null)}
          onSubmit={(data) => handleEdit(modalEdit.id, data)}
          loading={loading}
          error={error}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("deleteUser")}</p>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{deleteTarget.email}</p>
              </div>
            </div>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
              {t("deleteUserDesc")}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? t("saving") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale confirmation reset mot de passe */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("resetPassword")}</p>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{resetTarget.name ?? resetTarget.email}</p>
              </div>
            </div>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
              {t("resetPasswordDesc", { email: resetTarget.email })}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setResetTarget(null)}
                disabled={loading}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleResetPassword(resetTarget)}
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? t("resetting") : t("reset")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale résultat reset */}
      {resetResult && (
        <ResetResultModal
          result={resetResult}
          onClose={() => setResetResult(null)}
        />
      )}

      {modalImport && (
        <ImportModal
          onClose={() => setModalImport(false)}
          onDone={() => { setModalImport(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}

function ResetResultModal({
  result,
  onClose,
}: {
  result: { password: string; emailSent: boolean; userName: string };
  onClose: () => void;
}) {
  const t = useTranslations("users");
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(result.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("passwordReset")}</p>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{result.userName}</p>
          </div>
        </div>

        <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl px-4 py-3 space-y-2">
          <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">{t("newPassword")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] font-mono tracking-wider">{result.password}</code>
            <button
              onClick={copy}
              className="p-2 rounded-lg hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] transition-colors text-[#6E6E73] dark:text-[#8E8E93]"
              title="Copier"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {result.emailSent ? (
          <p className="text-[13px] text-emerald-600 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {t("emailSent")}
          </p>
        ) : (
          <p className="text-[13px] text-amber-600">
            ⚠️ {t("emailNotSent")}
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium transition-colors"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}

function UserTableRow({
  user,
  currentUserId,
  onToggle,
  onEdit,
  onDelete,
  onReset,
}: {
  user: UserRow;
  currentUserId: string;
  onToggle: (u: UserRow) => void;
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  onReset: (u: UserRow) => void;
}) {
  const t = useTranslations("users");
  return (
    <tr className={cn("hover:bg-[#F9F9FB] transition-colors", !user.isActive && "opacity-60")}>
      <td className="px-5 py-3.5">
        <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{user.name ?? <span className="italic text-[#ADADB8]">{t("noName")}</span>}</p>
        <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{user.email}</p>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {user.roles.length === 0 ? (
            <span className="text-[12px] text-[#ADADB8] italic">{t("none")}</span>
          ) : user.roles.map((r) => (
            <span key={r} className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", ROLE_COLORS[r])}>
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {user.teams.length === 0 ? (
            <span className="text-[12px] text-[#ADADB8] italic">—</span>
          ) : user.teams.map((t) => (
            <span key={t.id} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
              {t.name}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={cn(
          "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg",
          user.isActive ? "bg-green-50 text-green-600" : "bg-[#F5F5F7] text-[#6E6E73]"
        )}>
          {user.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
          {user.isActive ? "Actif" : "Inactif"}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onToggle(user)}
            disabled={user.id === currentUserId}
            title={user.isActive ? t("deactivate") : t("enable")}
            className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {user.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onEdit(user)}
            title="Modifier"
            className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReset(user)}
            disabled={user.id === currentUserId}
            title={t("resetPassword")}
            className="p-2 rounded-lg text-[#6E6E73] hover:bg-amber-50 hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(user)}
            disabled={user.id === currentUserId}
            title={t("delete")}
            className="p-2 rounded-lg text-[#6E6E73] hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserModal({
  title,
  initial,
  initialManagedTeamId = null,
  teams,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  title: string;
  initial?: UserRow;
  initialManagedTeamId?: string | null;
  teams: TeamRef[];
  onClose: () => void;
  onSubmit: (data: {
    name: string; email: string; password: string; roles: RoleType[]; isActive: boolean; managedTeamId: string | null;
  }) => void;
  loading: boolean;
  error: string;
}) {
  const t = useTranslations("users");
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(initial?.roles.includes("admin") ?? false);
  const [opRole, setOpRole] = useState<OperationalRole>(
    getOperationalRole(initial?.roles ?? ["learner"])
  );
  const roles = buildRoles(isAdmin, opRole);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [showPassword, setShowPassword] = useState(false);
  const [managedTeamId, setManagedTeamId] = useState<string | null>(initialManagedTeamId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0071E3]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
            <X className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, password, roles, isActive, managedTeamId }); }}
          className="p-6 space-y-4"
        >
          {error && (
            <div className="text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("email")} <span className="text-red-500">*</span></label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>

          {initial ? (
            /* Édition — champ optionnel pour changer le mot de passe */
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t("password")} <span className="text-[#ADADB8] dark:text-[#636366] font-normal">(laisser vide pour ne pas changer)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ADADB8] hover:text-[#6E6E73]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (() => {
                const check = validatePassword(password);
                const passed = RULES.filter((r) => r.test(password)).length;
                const colors = ["bg-red-400", "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-emerald-500"];
                const labels = ["", "Très faible", "Faible", "Moyen", "Fort", "Très fort"];
                const labelColors = ["", "text-red-500", "text-red-500", "text-orange-500", "text-amber-500", "text-emerald-600"];
                return (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex gap-1">
                      {RULES.map((_, i) => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i < passed ? colors[passed] : "bg-[#E5E5EA]")} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px] font-medium", labelColors[passed])}>{labels[passed]}</span>
                      {check.errors.length > 0 && (
                        <span className="text-[11px] text-[#8E8E93]">Manque : {check.errors.join(", ")}</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Création — mot de passe généré automatiquement */
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-blue-50 dark:bg-[#0071E3]/10 border border-blue-100 dark:border-[#0071E3]/20">
              <KeyRound className="w-4 h-4 text-[#0071E3] shrink-0" />
              <p className="text-[13px] text-[#0071E3]">
                Un mot de passe fort sera généré automatiquement et envoyé par email à l&apos;utilisateur.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {/* Toggle admin */}
            <div>
              <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("adminAccess")}</label>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsAdmin((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all",
                    isAdmin ? ROLE_COLORS_ACTIVE.admin : "border-[#D2D2D7] text-[#6E6E73] hover:border-[#ADADB8]"
                  )}
                >
                  {ROLE_LABELS.admin}
                </button>
              </div>
            </div>

            {/* Rôle opérationnel cascade */}
            <div>
              <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("operationalRole")}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["manager", "creator", "learner"] as OperationalRole[]).map((r) => {
                  const isPrimary = r === opRole;
                  const isImplied = !isPrimary && roles.includes(r as RoleType);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setOpRole(r)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all",
                        isPrimary
                          ? ROLE_COLORS_ACTIVE[r as RoleType]
                          : isImplied
                            ? cn(ROLE_COLORS_IMPLIED[opRole as RoleType], "cursor-default")
                            : "border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#ADADB8]"
                      )}
                    >
                      {ROLE_LABELS[r as RoleType]}
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setOpRole("none")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all",
                      opRole === "none"
                        ? "bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] border-[#1D1D1F] dark:border-[#F5F5F7]"
                        : "border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#ADADB8]"
                    )}
                  >
                    {t("roleNone")}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#ADADB8] mt-1.5">
                {opRole === "manager" && t("roleManagerDesc")}
                {opRole === "creator" && t("roleCreatorDesc")}
                {opRole === "learner" && t("roleLearnerDesc")}
                {opRole === "none" && isAdmin && t("roleAdminDesc")}
              </p>
            </div>
          </div>

          {/* Manager de */}
          {opRole === "manager" && teams.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-purple-500" />
                {t("teamManager")}
              </label>
              <select
                value={managedTeamId ?? ""}
                onChange={(e) => setManagedTeamId(e.target.value || null)}
                className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] text-[14px] text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
              >
                <option value="">{t("noTeamOption")}</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {initial && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors",
                  isActive ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform",
                  isActive ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
                )} />
              </div>
              <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("activeAccount")}</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? t("saving") : initial ? t("save") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
