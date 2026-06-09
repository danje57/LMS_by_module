"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Download, Search, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "course.start":           { label: "Cours démarré",       color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10" },
  "course.complete":        { label: "Cours terminé",       color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
  "quiz.submit":            { label: "Quiz soumis",         color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
  "certificate.generate":   { label: "Certificat généré",   color: "text-purple-600 bg-purple-50 dark:bg-purple-500/10" },
  "certificate.download":   { label: "Certificat consulté", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" },
  "document.upload":        { label: "Document uploadé",    color: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" },
  "document.edit":          { label: "Document modifié",    color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10" },
  "document.view":          { label: "Document consulté",   color: "text-sky-600 bg-sky-50 dark:bg-sky-500/10" },
  "document.signed":        { label: "Document signé",      color: "text-teal-600 bg-teal-50 dark:bg-teal-500/10" },
  "document.force-signed":  { label: "Signature forcée",    color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
  "document.delete":        { label: "Document supprimé",   color: "text-red-600 bg-red-50 dark:bg-red-500/10" },
};

type ActionFilter = "all" | "course" | "quiz" | "certificate" | "document";

const FILTER_CHIPS: { key: ActionFilter; label: string }[] = [
  { key: "all",         label: "Tous" },
  { key: "course",      label: "Cours" },
  { key: "quiz",        label: "Quiz" },
  { key: "certificate", label: "Certificats" },
  { key: "document",    label: "Documents" },
];

type Row = {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetLabel: string | null;
};

type Mode = "week" | "history";

export default function ActivityClient() {
  const [mode, setMode] = useState<Mode>("week");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const limit = 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ mode, page: String(page) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (actionFilter !== "all") params.set("actionFilter", actionFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to", dateTo);
    const res = await fetch(`/api/admin/activity?${params}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setActiveUsersCount(data.activeUsersCount ?? null);
    setLoading(false);
  }, [mode, page, debouncedSearch, actionFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleModeChange(m: Mode) {
    setMode(m);
    setPage(1);
    setSearch("");
    setActionFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function clearDates() {
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function handleFilterChange(f: ActionFilter) {
    setActionFilter(f);
    setPage(1);
  }

  function exportCsv() {
    const params = new URLSearchParams({ mode, csv: "1" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (actionFilter !== "all") params.set("actionFilter", actionFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to", dateTo);
    window.open(`/api/admin/activity?${params}`, "_blank");
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Activité des apprenants</h1>
          <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            {mode === "week" ? "Utilisateurs actifs cette semaine" : "Historique sur 6 mois"}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl w-fit">
        {([
          { key: "week"    as const, label: "Cette semaine" },
          { key: "history" as const, label: "6 derniers mois" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleModeChange(key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all",
              mode === key
                ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats banner (week mode) */}
      {mode === "week" && activeUsersCount !== null && (
        <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-sky-800 dark:text-sky-300">
              {activeUsersCount} utilisateur{activeUsersCount > 1 ? "s" : ""} actif{activeUsersCount > 1 ? "s" : ""} cette semaine
            </p>
            <p className="text-[12px] text-sky-600 dark:text-sky-400">Cours démarrés, terminés, quiz soumis ou certificats</p>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou titre du cours / document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] font-medium border transition-all",
                actionFilter === key
                  ? "bg-[#0071E3] border-[#0071E3] text-white"
                  : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#0071E3] hover:text-[#0071E3]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] shrink-0">Période :</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
          />
          <span className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">→</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={clearDates}
              className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#FF3B30] transition-colors"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#ADADB8]">
            <Activity className="w-5 h-5 animate-pulse mr-2" />
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-8 h-8 text-[#ADADB8] mb-3" />
            <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Aucune activité</p>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">
              {mode === "week" ? "Personne n'a été actif cette semaine." : "Aucune activité sur les 6 derniers mois."}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_160px_140px] gap-4 px-5 py-2.5 border-b border-[#F5F5F7] dark:border-[#2C2C2E] bg-[#F9F9F9] dark:bg-[#2C2C2E]">
              {["Utilisateur", "Cours", "Action", "Date"].map((h) => (
                <span key={h} className="text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
              {rows.map((row) => {
                const badge = ACTION_LABELS[row.action];
                return (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_160px_140px] gap-4 px-5 py-3 items-center hover:bg-[#F9F9F9] dark:hover:bg-[#2C2C2E] transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{row.actorName ?? "—"}</p>
                      <p className="text-[11px] text-[#ADADB8] truncate">{row.actorEmail ?? ""}</p>
                    </div>
                    <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] truncate">{row.targetLabel ?? "—"}</p>
                    <span className={cn("inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-lg w-fit", badge?.color ?? "text-[#6E6E73] bg-[#F5F5F7]")}>
                      {badge?.label ?? row.action}
                    </span>
                    <p className="text-[12px] text-[#ADADB8]">{fmtDate(row.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} sur {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] px-2">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
