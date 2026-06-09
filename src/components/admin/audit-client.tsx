"use client";

import { useState, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronRight } from "lucide-react";

export type AuditEntry = {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "auth.login":           { label: "Connexion",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "auth.logout":          { label: "Déconnexion",           color: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400" },
  "auth.login_failed":    { label: "Échec connexion",       color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  "course.upload":        { label: "Cours créé",            color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  "course.edit":          { label: "Cours modifié",         color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  "course.delete":        { label: "Cours supprimé",        color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  "course.assign":        { label: "Cours affecté",         color: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" },
  "course.start":         { label: "Cours démarré",         color: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
  "course.complete":      { label: "Cours terminé",         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "quiz.submit":          { label: "Quiz soumis",           color: "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" },
  "certificate.download": { label: "Certificat consulté",   color: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" },
  "user.create":          { label: "Utilisateur créé",      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "user.edit":            { label: "Utilisateur modifié",   color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  "user.delete":          { label: "Utilisateur supprimé",  color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  "user.activate":        { label: "Compte réactivé",       color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "user.deactivate":      { label: "Compte suspendu",       color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  "user.reset_password":  { label: "Mot de passe réinitialisé", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" },
  "user.import":          { label: "Import utilisateurs",   color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  "team.create":          { label: "Équipe créée",          color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "team.edit":            { label: "Équipe modifiée",       color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  "team.delete":          { label: "Équipe supprimée",      color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  "team.member.add":      { label: "Membre ajouté",         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  "team.member.remove":   { label: "Membre retiré",         color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  "team.import":          { label: "Import équipes",        color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  "settings.branding":    { label: "Branding modifié",      color: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400" },
  "settings.mail":        { label: "Email modifié",         color: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400" },
  "certificate.generate": { label: "Certificat généré",     color: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" },
  "setup.init":           { label: "Installation initiale", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  "document.upload":      { label: "Document uploadé",      color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  "document.edit":        { label: "Document modifié",      color: "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" },
  "document.view":        { label: "Document consulté",     color: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
  "document.signed":      { label: "Document signé",        color: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" },
  "document.force-signed":{ label: "Signature forcée",      color: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
  "document.delete":      { label: "Document supprimé",     color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

const PAGE_SIZE = 25;

const ACTION_GROUPS = [
  { label: "Authentification", actions: ["auth.login", "auth.logout", "auth.login_failed"] },
  { label: "Cours", actions: ["course.upload", "course.edit", "course.delete", "course.assign", "course.start", "course.complete"] },
  { label: "Quiz & Certificats", actions: ["quiz.submit", "certificate.download", "certificate.generate"] },
  { label: "Utilisateurs", actions: ["user.create", "user.edit", "user.delete", "user.activate", "user.deactivate", "user.reset_password", "user.import"] },
  { label: "Équipes", actions: ["team.create", "team.edit", "team.delete", "team.member.add", "team.member.remove", "team.import"] },
  { label: "Paramètres", actions: ["settings.branding", "settings.mail", "setup.init"] },
  { label: "Documents GRC", actions: ["document.upload", "document.edit", "document.view", "document.signed", "document.force-signed", "document.delete"] },
];

export function AuditClient({ entries }: { entries: AuditEntry[] }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = entries.filter((e) => {
    const matchSearch =
      (e.actorName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.actorEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.targetLabel ?? "").toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === "all" || e.action === filterAction;
    return matchSearch && matchAction;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher par acteur ou cible…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); resetPage(); }}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">Toutes les actions</option>
          {ACTION_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Compteur */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
          {filtered.length} événement{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-12 text-center">
          <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">Aucun événement trouvé.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Date</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Acteur</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Action</th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Cible</th>
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
              {paginated.map((e) => {
                const meta = ACTION_LABELS[e.action] ?? { label: e.action, color: "bg-[#F5F5F7] text-[#6E6E73]" };
                const isExpanded = expanded === e.id;
                const hasDetails = e.details && Object.keys(e.details).length > 0;
                return (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93] whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{e.actorName ?? "—"}</p>
                        <p className="text-[11px] text-[#ADADB8]">{e.actorEmail ?? ""}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex items-center text-[12px] font-medium rounded-lg px-2 py-0.5", meta.color)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] max-w-[200px] truncate">
                        {e.targetLabel ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {hasDetails && (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : e.id)}
                            className="p-1 rounded-lg text-[#ADADB8] hover:text-[#0071E3] transition-colors"
                          >
                            <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                        <td colSpan={5} className="px-5 py-3">
                          <pre className="text-[12px] text-[#3C3C43] dark:text-[#AEAEB2] font-mono whitespace-pre-wrap">
                            {JSON.stringify(e.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 w-8 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-colors flex items-center justify-center">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p); return acc;
              }, [])
              .map((p, i) => p === "…"
                ? <span key={`e${i}`} className="h-8 w-8 flex items-center justify-center text-[13px] text-[#ADADB8]">…</span>
                : <button key={p} onClick={() => setPage(p as number)}
                    className={cn("h-8 w-8 rounded-lg text-[13px] font-medium transition-colors",
                      page === p ? "bg-[#0071E3] text-white" : "border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                    )}>{p}</button>
              )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="h-8 w-8 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-colors flex items-center justify-center">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
