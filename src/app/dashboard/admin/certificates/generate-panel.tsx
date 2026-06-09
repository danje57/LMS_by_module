"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X, BookOpen, ShieldCheck, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface User    { id: string; name: string | null; email: string; isActive: boolean }
interface Course  { id: string; title: string; hasQuiz: boolean }
interface DocItem { id: string; title: string }
interface Team    { id: string; name: string; members: { id: string; name: string | null; email: string }[] }

function ItemPicker<T extends { id: string; title?: string; name?: string | null; email?: string }>({
  label,
  icon: Icon,
  iconColor,
  items,
  selected,
  onToggle,
  placeholder,
  renderSub,
  defaultOpen = true,
}: {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  renderSub?: (item: T) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen]   = useState(defaultOpen);
  const [search, setSearch] = useState("");

  const filtered = items.filter((item) => {
    const text = (item.title ?? `${item.name ?? ""} ${item.email ?? ""}`).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const displayName = (item: T) => item.title ?? item.name ?? item.email ?? "";

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          <Icon className={cn("w-4 h-4", iconColor)} />
          {label}
          {selected.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0071E3] text-[11px] font-bold text-white">
              {selected.length}
            </span>
          )}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />
          : <ChevronDown className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />}
      </button>

      {open && (
        <div className="border-t border-[#F2F2F7] dark:border-[#3A3A3C]">
          <div className="px-4 py-2.5">
            <input
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] px-3.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-[#F2F2F7] dark:divide-[#2C2C2E]">
            {filtered.map((item) => (
              <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="rounded border-[#C7C7CC] text-[#0071E3] focus:ring-[#0071E3]/40"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{displayName(item)}</p>
                  {renderSub && (
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">{renderSub(item)}</p>
                  )}
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-[13px] text-[#6E6E73] dark:text-[#8E8E93] text-center">Aucun élément trouvé</p>
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[#F2F2F7] dark:border-[#3A3A3C] px-4 py-2 flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const item = items.find((x) => x.id === id);
                if (!item) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#0071E3]/10 text-[11px] text-[#0071E3] font-medium">
                    {displayName(item)}
                    <button onClick={() => onToggle(id)} className="hover:text-[#D32F2F]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GeneratePanel() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [docs,    setDocs]    = useState<DocItem[]>([]);

  const [userMode,        setUserMode]        = useState<"individual" | "team">("individual");
  const [selectedUsers,   setSelectedUsers]   = useState<string[]>([]);
  const [selectedTeams,   setSelectedTeams]   = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedDocs,    setSelectedDocs]    = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ generated: number; skipped: number } | null>(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: User[]) => setUsers(data.filter((u) => u.isActive)))
      .catch(() => {});
    fetch("/api/admin/teams")
      .then((r) => r.json())
      .then(setTeams)
      .catch(() => {});
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then(setCourses)
      .catch(() => {});
    fetch("/api/admin/documents")
      .then((r) => r.json())
      .then((data: DocItem[] | unknown) =>
        setDocs(Array.isArray(data) ? data : [])
      )
      .catch(() => {});
  }, []);

  // Résolution des userIds effectifs selon le mode
  const effectiveUserIds = useMemo(() => {
    if (userMode === "individual") return selectedUsers;
    const ids = new Set<string>();
    for (const teamId of selectedTeams) {
      teams.find((t) => t.id === teamId)?.members.forEach((m) => ids.add(m.id));
    }
    return [...ids];
  }, [userMode, selectedUsers, selectedTeams, teams]);

  const totalItems  = selectedCourses.length + selectedDocs.length;
  const canGenerate = effectiveUserIds.length > 0 && totalItems > 0;

  const toggleUser   = (id: string) => setSelectedUsers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleTeam   = (id: string) => setSelectedTeams((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleCourse = (id: string) => setSelectedCourses((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleDoc    = (id: string) => setSelectedDocs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: effectiveUserIds,
          courseIds: selectedCourses,
          documentIds: selectedDocs,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
      setSelectedUsers([]);
      setSelectedTeams([]);
      setSelectedCourses([]);
      setSelectedDocs([]);
    } catch {
      setError("Une erreur s'est produite.");
    } finally {
      setLoading(false);
    }
  };

  const teamMemberCount = useMemo(() => {
    const ids = new Set<string>();
    for (const teamId of selectedTeams) {
      teams.find((t) => t.id === teamId)?.members.forEach((m) => ids.add(m.id));
    }
    return ids.size;
  }, [selectedTeams, teams]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Générer des certificats</h2>
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          Émet manuellement des certificats de formation ou des attestations GRC. Les certificats déjà existants sont ignorés.
        </p>
      </div>

      {/* Sélection des apprenants */}
      <div className="space-y-3">
        {/* Toggle mode */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2]">Apprenants</span>
          <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl">
            <button
              onClick={() => { setUserMode("individual"); setSelectedTeams([]); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                userMode === "individual"
                  ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                  : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
              )}
            >
              <Users className="w-3.5 h-3.5" />Par utilisateur
            </button>
            <button
              onClick={() => { setUserMode("team"); setSelectedUsers([]); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                userMode === "team"
                  ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                  : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
              )}
            >
              <UsersRound className="w-3.5 h-3.5" />Par équipe(s)
            </button>
          </div>
        </div>

        {userMode === "individual" ? (
          <ItemPicker
            label="Utilisateurs"
            icon={Users}
            iconColor="text-[#6E6E73]"
            items={users}
            selected={selectedUsers}
            onToggle={toggleUser}
            placeholder="Rechercher un apprenant…"
            renderSub={(u) => u.email ?? ""}
            defaultOpen={false}
          />
        ) : (
          <ItemPicker
            label="Équipes / Départements"
            icon={UsersRound}
            iconColor="text-[#6E6E73]"
            items={teams}
            selected={selectedTeams}
            onToggle={toggleTeam}
            placeholder="Rechercher une équipe…"
            renderSub={(t) => `${t.members.length} membre${t.members.length !== 1 ? "s" : ""}`}
            defaultOpen={false}
          />
        )}

        {/* Aperçu des membres résolus en mode équipe */}
        {userMode === "team" && selectedTeams.length > 0 && (
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] px-1">
            → <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{teamMemberCount}</strong> apprenant{teamMemberCount !== 1 ? "s" : ""} unique{teamMemberCount !== 1 ? "s" : ""} dans {selectedTeams.length} équipe{selectedTeams.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Cours + Documents GRC côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ItemPicker
          label="Cours (formations)"
          icon={BookOpen}
          iconColor="text-emerald-500"
          items={courses}
          selected={selectedCourses}
          onToggle={toggleCourse}
          placeholder="Rechercher un cours…"
          renderSub={(c) => c.hasQuiz ? "Avec évaluation" : "Sans évaluation"}
          defaultOpen={false}
        />
        <ItemPicker
          label="Documents GRC"
          icon={ShieldCheck}
          iconColor="text-indigo-500"
          items={docs}
          selected={selectedDocs}
          onToggle={toggleDoc}
          placeholder="Rechercher un document…"
          defaultOpen={false}
        />
      </div>

      {/* Résumé + action */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 space-y-4">
        {canGenerate ? (
          <p className="text-[13px] text-[#3C3C43] dark:text-[#AEAEB2]">
            Génération de <strong>{effectiveUserIds.length * totalItems}</strong> certificat(s) max —{" "}
            {userMode === "team"
              ? <><strong>{selectedTeams.length}</strong> équipe{selectedTeams.length !== 1 ? "s" : ""} (<strong>{effectiveUserIds.length}</strong> apprenants)</>
              : <><strong>{effectiveUserIds.length}</strong> apprenant{effectiveUserIds.length !== 1 ? "s" : ""}</>
            }
            {selectedCourses.length > 0 && <> × <strong>{selectedCourses.length}</strong> cours</>}
            {selectedCourses.length > 0 && selectedDocs.length > 0 && " + "}
            {selectedDocs.length > 0 && <><strong>{selectedDocs.length}</strong> doc{selectedDocs.length !== 1 ? "s" : ""} GRC</>}.
            {" "}Les existants seront ignorés.
          </p>
        ) : (
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            Sélectionnez{" "}
            {userMode === "individual" ? "au moins un apprenant" : "au moins une équipe"}{" "}
            et un cours ou document GRC.
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          className="h-9 px-5 rounded-lg bg-[#0071E3] text-[13px] font-medium text-white hover:bg-[#0077ED] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Génération en cours…" : "Générer les certificats"}
        </button>

        {result && (
          <div className="flex items-start gap-2.5 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[13px] text-emerald-700 dark:text-emerald-400">
              <strong>{result.generated}</strong> certificat(s) généré(s).
              {result.skipped > 0 && <> <strong>{result.skipped}</strong> ignoré(s) (déjà existants).</>}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
