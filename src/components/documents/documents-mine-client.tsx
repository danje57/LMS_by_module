"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, Clock, Award, Search, Play, Users, ArrowUpDown } from "lucide-react";
import { PdfThumbnail } from "@/components/documents/pdf-thumbnail";
import { cn } from "@/lib/utils";
import type { MyDoc } from "@/app/dashboard/documents/page";

type Status = "not_started" | "in_progress" | "signed";
type Filter = "all" | Status;

const PAGE_SIZES = [0, 5, 10, 20, 50] as const;

const GROUPS: { key: Status; label: string; color: string }[] = [
  { key: "not_started", label: "Non lu",   color: "bg-[#0071E3]"  },
  { key: "in_progress", label: "En cours", color: "bg-amber-400"  },
  { key: "signed",      label: "Signé",    color: "bg-emerald-400" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function DocumentsMineClient({ docs }: { docs: MyDoc[] }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<Filter>("all");
  const [sizeSort, setSizeSort] = useState<"none" | "asc" | "desc">("none");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page,     setPage]     = useState(1);

  function resetPage() { setPage(1); }

  const filtered = useMemo(() => {
    let list = docs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q));
    }
    if (sizeSort !== "none") {
      list = [...list].sort((a, b) =>
        sizeSort === "asc" ? a.fileSize - b.fileSize : b.fileSize - a.fileSize
      );
    }
    return list;
  }, [docs, search, sizeSort]);

  const totalItems = filtered.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const paginated  = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <FileText className="w-12 h-12 text-[#D2D2D7]" />
        <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Aucun document assigné</p>
        <p className="text-[13px] text-[#6E6E73]">Vous n'avez pas de document à signer pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Barre d'outils — même pattern que cours ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher un document…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        {/* Tri taille — toggle button identique au tri Durée dans cours */}
        <button
          onClick={() => { setSizeSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none")); resetPage(); }}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-[13px] font-medium transition-all whitespace-nowrap",
            sizeSort !== "none"
              ? "bg-[#0071E3] border-[#0071E3] text-white shadow-sm"
              : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          )}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Taille
          {sizeSort === "asc"  && <span className="text-[11px]">↑</span>}
          {sizeSort === "desc" && <span className="text-[11px]">↓</span>}
        </button>

        {/* Taille de page — select identique à cours */}
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all cursor-pointer"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s === 0 ? "Tous" : `${s} / page`}</option>
          ))}
        </select>
      </div>

      {/* ── Chips de filtre statut — même style exact que cours ── */}
      <div className="flex gap-1.5 bg-white dark:bg-[#2C2C2E] border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl p-1 w-fit">
        {([
          { key: "all"         as const, label: "Tous",     dot: null            },
          { key: "not_started" as const, label: "Non lu",   dot: "bg-[#0071E3]"  },
          { key: "in_progress" as const, label: "En cours", dot: "bg-amber-400"  },
          { key: "signed"      as const, label: "Signé",    dot: "bg-emerald-400" },
        ]).map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); resetPage(); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
              filter === key
                ? "bg-[#0071E3] text-white shadow-sm"
                : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            )}
          >
            {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", filter === key ? "bg-white" : dot)} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Sections groupées ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Aucun document trouvé</p>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">Modifiez votre recherche ou vos filtres.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(({ key, label, color }) => {
            if (filter !== "all" && filter !== key) return null;
            const group = paginated.filter((d) => d.status === key);
            if (group.length === 0) return null;

            return (
              <div key={key}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                  <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{label}</h2>
                  <span className="text-[12px] text-[#ADADB8] font-medium">
                    {filtered.filter((d) => d.status === key).length}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((doc) => (
                    <div
                      key={doc.id}
                      className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden hover:shadow-md hover:border-[#D2D2D7] dark:hover:border-[#636366] transition-all flex flex-col"
                    >
                      <div className="h-36 overflow-hidden">
                        <PdfThumbnail docId={doc.id} />
                      </div>

                      <div className="p-5 flex flex-col gap-3 flex-1">
                        <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug line-clamp-2">
                          {doc.title}
                        </h3>

                        {doc.teamName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10 rounded-lg px-2 py-0.5 w-fit">
                            <Users className="w-3 h-3" />
                            {doc.teamName}
                          </span>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1">
                            <FileText className="w-3 h-3" />
                            {formatSize(doc.fileSize)}
                          </span>
                          {doc.dueDate && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1">
                              <Clock className="w-3 h-3" />
                              Échéance {formatDate(doc.dueDate)}
                            </span>
                          )}
                        </div>

                        {(doc.createdByName || doc.assignedByName) && (
                          <p className="text-[11px] text-[#ADADB8] leading-relaxed">
                            {doc.createdByName && (
                              <span>Créé par <span className="text-[#6E6E73] dark:text-[#8E8E93]">{doc.createdByName}</span></span>
                            )}
                            {doc.createdByName && doc.assignedByName && <span> · </span>}
                            {doc.assignedByName && (
                              <span>Affecté par <span className="text-[#6E6E73] dark:text-[#8E8E93]">{doc.assignedByName}</span></span>
                            )}
                          </p>
                        )}

                        <div className="flex-1" />

                        <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F7] dark:border-[#2C2C2E]">
                          <span className="text-[11px] text-[#ADADB8]">{formatSize(doc.fileSize)}</span>
                          <div className="flex items-center gap-1.5">
                            {doc.certificateId && key === "signed" && (
                              <Link
                                href={`/dashboard/certificates/${doc.certificateId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-[13px] font-medium rounded-xl transition-colors"
                              >
                                <Award className="w-3.5 h-3.5" />
                                Attestation
                              </Link>
                            )}
                            <Link
                              href={`/dashboard/documents/${doc.id}`}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl transition-colors",
                                key === "signed"
                                  ? "border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                                  : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                              )}
                            >
                              <Play className="w-3.5 h-3.5" />
                              {key === "in_progress" ? "Reprendre" : key === "signed" ? "Réviser" : "Lancer"}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} sur {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-1 text-[#ADADB8] text-[13px]">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={cn(
                      "min-w-[32px] px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                      page === p ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                    )}>
                    {p}
                  </button>
                )
              )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              ›
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
