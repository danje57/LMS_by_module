"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle, AlertCircle, UploadCloud, Loader2, UserPlus, ArchiveRestore } from "lucide-react";
import { validatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

type Mode = "create" | "restore";

export function SetupForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");

  // — Création compte —
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // — Restauration —
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreDone, setRestoreDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pwdCheck = validatePassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const fieldClass = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#ADADB8] dark:placeholder-[#636366] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
  const labelClass = "block text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2] mb-1.5";
  const strengthColor = pwdCheck.strength === "strong" ? "bg-emerald-400" : pwdCheck.strength === "medium" ? "bg-amber-400" : "bg-red-400";
  const strengthWidth = password.length === 0 ? "w-0" : pwdCheck.strength === "strong" ? "w-full" : pwdCheck.strength === "medium" ? "w-2/3" : "w-1/3";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (!pwdCheck.valid) { setError(`Mot de passe trop faible : ${pwdCheck.errors.join(", ")}.`); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Une erreur est survenue."); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) return;
    setRestoreLoading(true);
    setRestoreError("");
    const form = new FormData();
    form.append("file", restoreFile);
    const res = await fetch("/api/setup/restore", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setRestoreLoading(false);
    if (!res.ok) { setRestoreError(json.error ?? "Erreur lors de la restauration."); return; }
    setRestoreDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Compte créé !</p>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">Redirection vers la connexion…</p>
      </div>
    );
  }

  if (restoreDone) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Restauration réussie !</p>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Toggle mode */}
      <div className="flex gap-1 p-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl">
        <button
          type="button"
          onClick={() => { setMode("create"); setError(""); setRestoreError(""); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-[13px] font-medium transition-all",
            mode === "create"
              ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
              : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          )}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Créer un compte
        </button>
        <button
          type="button"
          onClick={() => { setMode("restore"); setError(""); setRestoreError(""); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-[13px] font-medium transition-all",
            mode === "restore"
              ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
              : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          )}
        >
          <ArchiveRestore className="w-3.5 h-3.5" />
          Restaurer un backup
        </button>
      </div>

      {/* — Mode création — */}
      {mode === "create" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nom <span className="text-[#ADADB8] font-normal">(optionnel)</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Mot de passe *</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={cn(fieldClass, "pr-10")}
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ADADB8] hover:text-[#6E6E73]">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", strengthColor, strengthWidth)} />
                </div>
                {!pwdCheck.valid && <p className="text-[11px] text-[#8E8E93]">Requis : {pwdCheck.errors.join(", ")}</p>}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Confirmer le mot de passe *</label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className={cn(fieldClass, mismatch && "border-red-400 focus:border-red-400 focus:ring-red-400/20")}
            />
            {mismatch && <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>}
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !pwdCheck.valid || mismatch || !email}
            className="w-full h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "Création…" : "Créer le compte administrateur"}
          </button>
        </form>
      )}

      {/* — Mode restauration — */}
      {mode === "restore" && (
        <form onSubmit={handleRestore} className="space-y-4">
          <div className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl px-4 py-3">
            Sélectionnez un fichier de backup <code className="text-[12px] font-mono">.zip</code> pour restaurer
            l&apos;application dans son état précédent. Toutes les données actuelles seront remplacées.
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
          />

          {!restoreFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#0071E3] hover:text-[#0071E3] transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              Choisir un fichier .zip
            </button>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{restoreFile.name}</p>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                  {(restoreFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setRestoreFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-[12px] text-[#6E6E73] hover:text-red-500 ml-3 shrink-0 transition-colors"
              >
                Changer
              </button>
            </div>
          )}

          {restoreError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" />{restoreError}
            </div>
          )}

          <button
            type="submit"
            disabled={restoreLoading || !restoreFile}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors"
          >
            {restoreLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Restauration en cours…</> : "Restaurer le backup"}
          </button>
        </form>
      )}
    </div>
  );
}
