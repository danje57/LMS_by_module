"use client";

import { useState } from "react";
import { RoleType } from "@prisma/client";
import {
  Search, Plus, Pencil, Trash2, ShieldCheck,
  UserCheck, UserX, X, Eye, EyeOff, Crown, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportModal } from "@/components/admin/import-modal";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: RoleType[];
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
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<RoleType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [modalImport, setModalImport] = useState(false);

  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
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
    return matchSearch && matchRole && matchStatus;
  });

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
    setUsers((prev) => [json, ...prev]);
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
    setUsers((prev) => prev.map((u) => (u.id === id ? json : u)));
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
    setUsers((prev) => prev.map((u) => (u.id === user.id ? json : u)));
  }

  async function handleDelete(user: UserRow) {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) return;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] bg-white text-[14px] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <div className="flex gap-1.5 bg-white border border-[#D2D2D7] rounded-xl p-1">
          {(["all", "active", "inactive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterStatus === v ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              {v === "all" ? "Tous" : v === "active" ? "Actifs" : "Inactifs"}
            </button>
          ))}
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as RoleType | "all")}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">Tous les rôles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        <button
          onClick={() => setModalImport(true)}
          className="inline-flex items-center gap-2 h-10 px-4 bg-white border border-[#D2D2D7] hover:border-[#0071E3] hover:text-[#0071E3] text-[#1D1D1F] text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          Importer
        </button>

        <button
          onClick={() => { setModalCreate(true); setError(""); }}
          className="inline-flex items-center gap-2 h-10 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Créer
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">Utilisateur</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">Rôles</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7]">
              {filtered.map((user) => (
                <tr key={user.id} className={cn("hover:bg-[#F9F9FB] transition-colors", !user.isActive && "opacity-60")}>
                  <td className="px-5 py-3.5">
                    <p className="text-[14px] font-medium text-[#1D1D1F]">{user.name ?? <span className="italic text-[#ADADB8]">Sans nom</span>}</p>
                    <p className="text-[12px] text-[#6E6E73]">{user.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.length === 0 ? (
                        <span className="text-[12px] text-[#ADADB8] italic">Aucun</span>
                      ) : user.roles.map((r) => (
                        <span key={r} className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", ROLE_COLORS[r])}>
                          {ROLE_LABELS[r]}
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
                        onClick={() => handleToggleActive(user)}
                        disabled={user.id === currentUserId}
                        title={user.isActive ? "Désactiver" : "Activer"}
                        className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        {user.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setModalEdit(user); setError(""); }}
                        title="Modifier"
                        className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        disabled={user.id === currentUserId}
                        title="Supprimer"
                        className="p-2 rounded-lg text-[#6E6E73] hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
      {modalCreate && (
        <UserModal
          title="Créer un utilisateur"
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
          title="Modifier l'utilisateur"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1D1D1F]">Supprimer l&apos;utilisateur</p>
                <p className="text-[13px] text-[#6E6E73]">{deleteTarget.email}</p>
              </div>
            </div>
            <p className="text-[13px] text-[#6E6E73]">
              Les cours créés par cet utilisateur resteront accessibles. Cette action est irréversible.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0071E3]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
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
            <label className="text-[13px] font-medium text-[#1D1D1F]">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#1D1D1F]">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#1D1D1F]">
              Mot de passe {initial ? <span className="text-[#ADADB8] font-normal">(laisser vide pour ne pas changer)</span> : <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required={!initial}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initial ? "••••••••" : ""}
                className="w-full h-10 px-3 pr-10 rounded-xl border border-[#D2D2D7] text-[14px] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ADADB8] hover:text-[#6E6E73]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Toggle admin */}
            <div>
              <label className="text-[13px] font-medium text-[#1D1D1F]">Accès administration</label>
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
              <label className="text-[13px] font-medium text-[#1D1D1F]">Rôle opérationnel</label>
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
                            : "border-[#D2D2D7] text-[#6E6E73] hover:border-[#ADADB8]"
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
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F]"
                        : "border-[#D2D2D7] text-[#6E6E73] hover:border-[#ADADB8]"
                    )}
                  >
                    Aucun
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#ADADB8] mt-1.5">
                {opRole === "manager" && "Inclut les droits Créateur et Apprenant."}
                {opRole === "creator" && "Inclut les droits Apprenant."}
                {opRole === "learner" && "Suit les cours assignés."}
                {opRole === "none" && isAdmin && "Accès admin uniquement, sans suivi de cours."}
              </p>
            </div>
          </div>

          {/* Manager de */}
          {opRole === "manager" && teams.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#1D1D1F] flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-purple-500" />
                Manager de l&apos;équipe
              </label>
              <select
                value={managedTeamId ?? ""}
                onChange={(e) => setManagedTeamId(e.target.value || null)}
                className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] text-[14px] text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
              >
                <option value="">— Aucune équipe —</option>
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
              <span className="text-[13px] font-medium text-[#1D1D1F]">Compte actif</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Enregistrement…" : initial ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
