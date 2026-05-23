"use client";

import { useState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Download, Trash2, Plus, UploadCloud, ShieldAlert, Loader2, HardDrive, Clock, Terminal, Lock, Unlock, ShieldCheck, AlertCircle } from "lucide-react";

type BackupRow = {
  id: string;
  filename: string;
  sizeBytes: string | null;
  createdAt: string;
  createdBy: string | null;
  notes: string | null;
};

interface BackupManagerProps {
  initialBackups: BackupRow[];
  cronUrl: string;
}

function formatBytes(n: string | null): string {
  if (!n) return "—";
  const b = Number(n);
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function BackupManager({ initialBackups, cronUrl }: BackupManagerProps) {
  const t = useTranslations("backup");
  const [backups, setBackups] = useState<BackupRow[]>(initialBackups);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoring, startRestore] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Déverrouillage restauration (même pattern que cron secret)
  const [restoreUnlocked, setRestoreUnlocked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPwd, setConfirmPwd] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleConfirmPassword() {
    setConfirmLoading(true);
    setConfirmError("");
    const res = await fetch("/api/auth/confirm-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: confirmPwd }),
    });
    const d = await res.json().catch(() => ({}));
    setConfirmLoading(false);
    if (!res.ok) { setConfirmError(d.error ?? "Mot de passe incorrect."); return; }
    setRestoreUnlocked(true);
    setShowConfirmModal(false);
    setConfirmPwd("");
    setConfirmError("");
  }

  function flash(type: "ok" | "err", msg: string) {
    if (type === "ok") { setSuccess(msg); setError(null); }
    else { setError(msg); setSuccess(null); }
    setTimeout(() => { setSuccess(null); setError(null); }, 6000);
  }

  async function handleCreate() {
    setCreating(true); setError(null); setSuccess(null);
    const res = await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok) { flash("err", data.error ?? t("errorCreate")); }
    else {
      flash("ok", t("successCreate", { filename: data.filename }));
      const list = await fetch("/api/admin/backup").then((r) => r.json());
      setBackups(list);
    }
    setCreating(false);
  }

  async function handleDelete(id: string, filename: string) {
    if (!confirm(t("confirmDelete", { filename }))) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/backup/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); flash("err", d.error ?? t("errorDelete")); }
    else { setBackups((prev) => prev.filter((b) => b.id !== id)); flash("ok", t("successDelete")); }
    setDeletingId(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setRestoreFile(file);
    if (file) setConfirmRestore(true);
  }

  function resetRestore() {
    setConfirmRestore(false);
    setRestoreFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRestore() {
    if (!restoreFile) return;
    startRestore(async () => {
      setError(null); setSuccess(null);
      const form = new FormData();
      form.append("file", restoreFile);
      const res = await fetch("/api/admin/restore", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { flash("err", data.error ?? t("errorRestore")); }
      else {
        flash("ok", t("successRestore"));
        const list = await fetch("/api/admin/backup").then((r) => r.json());
        setBackups(list);
      }
      resetRestore();
    });
  }

  const cardClass = "bg-white dark:bg-[#111114] rounded-2xl border border-[#E5E5EA] dark:border-[#2C2C30] p-6 space-y-4";
  const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const btnGhost = "inline-flex items-center gap-1.5 p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">

      {/* Modale confirmation mot de passe */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#0071E3]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("confirmIdentity")}</p>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("confirmIdentityDesc")}</p>
              </div>
            </div>
            <input
              autoFocus
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirmPassword(); if (e.key === "Escape") setShowConfirmModal(false); }}
              placeholder={t("passwordPlaceholder")}
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
            />
            {confirmError && (
              <p className="text-[12px] text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{confirmError}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                {t("cancel")}
              </button>
              <button type="button" onClick={handleConfirmPassword} disabled={confirmLoading || !confirmPwd}
                className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors">
                {confirmLoading ? t("verifying") : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carte verrou — toujours visible */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("sectionTitle")}</h2>
          </div>
          {!restoreUnlocked ? (
            <button
              type="button"
              onClick={() => { setShowConfirmModal(true); setConfirmError(""); setConfirmPwd(""); }}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              {t("unlock")}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <Unlock className="w-3.5 h-3.5" />
              {t("unlocked")}
            </span>
          )}
        </div>
        {!restoreUnlocked && (
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("lockedDesc")}</p>
        )}
      </div>

      {/* Tout le contenu backup — visible seulement après déverrouillage */}
      {restoreUnlocked && (
        <>
          {/* Messages */}
          {error && <div className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-4 py-2.5 rounded-xl">{error}</div>}
          {success && <div className="text-[13px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 rounded-xl">{success}</div>}

          {/* Backup manuel */}
          <div className={cardClass}>
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#0071E3]" />
              {t("manualBackup")}
            </h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("manualBackupDesc")}</p>
            <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? t("creating") : t("createBackup")}
            </button>
          </div>

          {/* Restauration */}
          <div className={cn(cardClass, "border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5")}>
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              {t("restore")}
            </h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("restoreDesc")}</p>
            <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileSelect} />
            {!confirmRestore ? (
              <button onClick={() => fileInputRef.current?.click()} className={cn(btnPrimary, "bg-amber-500 hover:bg-amber-600")}>
                <UploadCloud className="w-3.5 h-3.5" />
                {t("selectBackupFile")}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-[13px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-4 py-3 rounded-xl font-medium">
                  ⚠️ {t("restoreWarning", { filename: restoreFile?.name ?? "" })}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleRestore} disabled={restoring} className={cn(btnPrimary, "bg-red-600 hover:bg-red-700")}>
                    {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    {restoring ? t("restoring") : t("confirmRestore")}
                  </button>
                  <button onClick={resetRestore} disabled={restoring}
                    className="px-4 py-2 text-[13px] font-medium rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cron auto */}
          <div className={cardClass}>
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0071E3]" />
              {t("autoBackup")}
            </h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("autoBackupDesc")}</p>
            <div className="flex items-center gap-2 bg-[#F5F5F7] dark:bg-[#1C1C20] rounded-xl px-4 py-3">
              <Terminal className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
              <code className="text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] break-all">{`0 2 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "${cronUrl}?keep=10"`}</code>
            </div>
            <p className="text-[12px] text-[#ADADB8] dark:text-[#636366]">{t("autoBackupNote")}</p>
          </div>

          {/* Liste des backups */}
          <div className={cardClass}>
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t("backupList")} <span className="text-[#ADADB8] font-normal">({backups.length})</span>
            </h2>
            {backups.length === 0 ? (
              <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] py-4">{t("noBackups")}</p>
            ) : (
              <div className="divide-y divide-[#E5E5EA] dark:divide-[#2C2C30]">
                {backups.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{b.filename}</p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                        {formatDate(b.createdAt)} · {formatBytes(b.sizeBytes)}
                        {b.createdBy && ` · ${b.createdBy}`}
                        {b.notes && ` · ${b.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={`/api/admin/backup/${b.id}/download`} download={b.filename} className={btnGhost} title={t("download")}>
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(b.id, b.filename)}
                        disabled={deletingId === b.id}
                        className={cn(btnGhost, "hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500")}
                        title={t("deleteBackup")}
                      >
                        {deletingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
