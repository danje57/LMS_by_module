"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { validatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pwdCheck = validatePassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

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

  const fieldClass = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#ADADB8] dark:placeholder-[#636366] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
  const labelClass = "block text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2] mb-1.5";

  const strengthColor = pwdCheck.strength === "strong" ? "bg-emerald-400" : pwdCheck.strength === "medium" ? "bg-amber-400" : "bg-red-400";
  const strengthWidth = password.length === 0 ? "w-0" : pwdCheck.strength === "strong" ? "w-full" : pwdCheck.strength === "medium" ? "w-2/3" : "w-1/3";

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

  return (
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
            {!pwdCheck.valid && (
              <p className="text-[11px] text-[#8E8E93]">Requis : {pwdCheck.errors.join(", ")}</p>
            )}
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
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
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
  );
}
