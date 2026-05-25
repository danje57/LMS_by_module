"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, Users, FileCheck, Trash2, CheckCircle2,
  Clock, X, Search, Eye, ArrowUpDown,
} from "lucide-react";
import { AssignModal } from "@/components/admin/assign-modal";
import { PdfThumbnail } from "@/components/documents/pdf-thumbnail";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  title: string;
  duration: number;
  fileSize: number;
  originalFileName: string;
  createdAt: string;
  department: string | null;
  createdByName: string | null;
  createdById: string | null;
  signatureCount: number;
  assignmentCount: number;
}

interface SignedEntry   { id: string; userId: string; name: string | null; email: string; signedAt: string; ipAddress: string | null; }
interface UnsignedEntry { userId: string; name: string | null; email: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_SIZES = [0, 5, 10, 20, 50] as const;

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Veuillez sélectionner un fichier PDF"); return; }
    setLoading(true); setError("");
    const form = new FormData();
    form.append("title", title);
    form.append("duration", "15");
    form.append("file", file);
    const res = await fetch("/api/admin/documents/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erreur lors de l'upload"); setLoading(false); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Uploader un PDF</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"><X className="w-4 h-4 text-[#6E6E73]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">Titre du document</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Charte informatique 2026"
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">Fichier PDF</label>
            <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl px-4 py-5 transition-colors ${file ? "border-[#0071E3] bg-blue-50 dark:bg-blue-500/10" : "border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3]"}`}>
              <FileCheck className={`w-5 h-5 shrink-0 ${file ? "text-[#0071E3]" : "text-[#ADADB8]"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] truncate block">{file ? file.name : "Cliquez pour sélectionner un PDF"}</span>
                {file && <span className="text-[11px] text-[#ADADB8]">{formatSize(file.size)}</span>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ")); }} />
            </label>
            <p className="text-[11px] text-[#ADADB8] mt-1">Max 100 Mo · Format PDF uniquement</p>
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-white text-[14px] font-medium transition-colors">
              {loading ? "Upload en cours…" : "Uploader"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Signatures modal ─────────────────────────────────────────────────────────

function SignaturesModal({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const [signed,   setSigned]   = useState<SignedEntry[] | null>(null);
  const [unsigned, setUnsigned] = useState<UnsignedEntry[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [forcing,  setForcing]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/documents/${doc.id}/signatures`);
    if (res.ok) { const d = await res.json(); setSigned(d.signed); setUnsigned(d.unsigned); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [doc.id]);

  async function forceSign(userId: string) {
    setForcing(userId);
    await fetch(`/api/admin/documents/${doc.id}/force-sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    await load();
    setForcing(null);
  }

  const total = (signed?.length ?? 0) + (unsigned?.length ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Suivi des signatures</h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{doc.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"><X className="w-4 h-4 text-[#6E6E73]" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {signed && signed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide px-1">Signés · {signed.length}</p>
                  {signed.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-500/10">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{s.name ?? s.email}</p>
                        <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">{s.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-[#ADADB8]">{new Date(s.signedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        <p className="text-[11px] text-[#ADADB8]">{new Date(s.signedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {unsigned && unsigned.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide px-1">En attente · {unsigned.length}</p>
                  {unsigned.map((u) => (
                    <div key={u.userId} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                      <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{u.name ?? u.email}</p>
                        <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">{u.email}</p>
                      </div>
                      <button onClick={() => forceSign(u.userId)} disabled={forcing === u.userId}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30 rounded-lg transition-colors disabled:opacity-50">
                        {forcing === u.userId ? "…" : "Forcer"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {total === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Clock className="w-8 h-8 text-[#D2D2D7]" />
                  <p className="text-[13px] text-[#6E6E73]">Aucun utilisateur assigné dans votre périmètre</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
          {!loading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#6E6E73] dark:text-[#8E8E93]">Taux de signature</span>
                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{signed?.length ?? 0} / {total}{total > 0 && ` · ${Math.round(((signed?.length ?? 0) / total) * 100)}%`}</span>
              </div>
              {total > 0 && (
                <div className="h-1.5 w-full bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round(((signed?.length ?? 0) / total) * 100)}%` }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentAdminClient({ initial, canUpload = true }: { initial: DocumentRow[]; canUpload?: boolean }) {
  const router = useRouter();
  const [docs, setDocs]               = useState<DocumentRow[]>(initial);
  const [search, setSearch]           = useState("");
  const [sizeSort, setSizeSort]       = useState<"none" | "asc" | "desc">("none");
  const [filterCreator, setFilterCreator] = useState("all");
  const [pageSize, setPageSize]       = useState<number>(10);
  const [page, setPage]               = useState(1);
  const [showUpload, setShowUpload]   = useState(false);
  const [assignDoc, setAssignDoc]     = useState<DocumentRow | null>(null);
  const [signaturesDoc, setSignaturesDoc] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);

  const creators = useMemo(() => {
    const names = [...new Set(docs.map((d) => d.createdByName).filter(Boolean) as string[])].sort();
    return names;
  }, [docs]);

  const filtered = useMemo(() => {
    let list = docs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q) || (d.createdByName ?? "").toLowerCase().includes(q));
    }
    if (filterCreator !== "all") list = list.filter((d) => d.createdByName === filterCreator);
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sizeSort !== "none") {
      list = [...list].sort((a, b) => sizeSort === "asc" ? a.fileSize - b.fileSize : b.fileSize - a.fileSize);
    }
    return list;
  }, [docs, search, sizeSort, filterCreator]);

  const totalPages  = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated   = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  function resetPage() { setPage(1); }

  async function refresh() {
    const res = await fetch("/api/admin/documents");
    if (res.ok) setDocs(await res.json());
    router.refresh();
  }

  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`Supprimer "${doc.title}" ? Cette action est irréversible.`)) return;
    setDeleting(doc.id);
    await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleting(null);
  }

  return (
    <>
      {/* ── Barre d'outils ── */}
      <div className="space-y-3">

        {/* Ligne 1 : recherche + upload */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
            <input
              type="text"
              placeholder="Rechercher un document…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              Uploader un PDF
            </button>
          )}
        </div>

        {/* Ligne 2 : tris + filtres + pagination taille — même pattern que cours */}
        <div className="flex items-center gap-2 flex-wrap">

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

          {/* Filtre par créateur (département) */}
          {creators.length > 0 && (
            <select
              value={filterCreator}
              onChange={(e) => { setFilterCreator(e.target.value); resetPage(); }}
              className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all cursor-pointer"
            >
              <option value="all">Tous les créateurs</option>
              {creators.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Compteur */}
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] shrink-0">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
          </span>

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
      </div>

      {/* ── Grille de documents ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText className="w-12 h-12 text-[#D2D2D7]" />
          <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
            {docs.length === 0 ? "Aucun document PDF" : "Aucun résultat"}
          </p>
          <p className="text-[13px] text-[#6E6E73]">
            {docs.length === 0
              ? canUpload ? "Uploadez votre premier document pour commencer." : "Aucun document dans votre périmètre."
              : "Modifiez votre recherche ou vos filtres."}
          </p>
          {docs.length === 0 && canUpload && (
            <button onClick={() => setShowUpload(true)} className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors">
              <Upload className="w-4 h-4" />Uploader un PDF
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((doc) => {
            const rate = doc.assignmentCount > 0 ? Math.round((doc.signatureCount / doc.assignmentCount) * 100) : 0;
            return (
              <div key={doc.id} className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden hover:shadow-md hover:border-[#D2D2D7] dark:hover:border-[#636366] transition-all flex flex-col">

                {/* Thumbnail */}
                <div className="h-36 overflow-hidden">
                  <PdfThumbnail docId={doc.id} />
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Titre */}
                  <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug line-clamp-2">
                    {doc.title}
                  </h3>

                  {/* Taille + date */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2 py-0.5">
                      <FileText className="w-3 h-3" />{formatSize(doc.fileSize)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2 py-0.5">
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>

                  {/* Créé par */}
                  {doc.createdByName && (
                    <p className="text-[11px] text-[#ADADB8]">
                      Créé par <span className="text-[#6E6E73] dark:text-[#8E8E93]">{doc.createdByName}</span>
                    </p>
                  )}

                  {/* Barre signatures */}
                  {doc.assignmentCount > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#6E6E73] dark:text-[#8E8E93]">{doc.signatureCount}/{doc.assignmentCount} signés</span>
                        <span className={cn("font-semibold", rate === 100 ? "text-emerald-600" : rate > 50 ? "text-amber-600" : "text-[#6E6E73]")}>{rate}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", rate === 100 ? "bg-emerald-400" : "bg-[#0071E3]")} style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F7] dark:border-[#2C2C2E]">
                    <span className="text-[11px] text-[#ADADB8]">{formatSize(doc.fileSize)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSignaturesDoc(doc)}
                        className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
                        title="Suivi des signatures"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setAssignDoc(doc)}
                        className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
                        title="Assigner"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={deleting === doc.id}
                        className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setAssignDoc(doc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] font-medium rounded-xl transition-colors"
                      >
                        <Users className="w-3 h-3" />
                        Assigner
                      </button>
                    </div>
                  </div>
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
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} sur {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-all">
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) => p === "…"
                ? <span key={`e${i}`} className="px-1 text-[#ADADB8] text-[13px]">…</span>
                : <button key={p} onClick={() => setPage(p as number)}
                    className={cn("w-8 h-8 rounded-lg text-[13px] font-medium transition-all",
                      page === p ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]")}>
                    {p}
                  </button>
              )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 transition-all">
              ›
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); refresh(); }} />}
      {assignDoc    && <AssignModal courseId={assignDoc.id} courseTitle={assignDoc.title} onClose={() => { setAssignDoc(null); refresh(); }} />}
      {signaturesDoc && <SignaturesModal doc={signaturesDoc} onClose={() => setSignaturesDoc(null)} />}
    </>
  );
}
