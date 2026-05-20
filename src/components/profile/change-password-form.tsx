"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePassword, RULES } from "@/lib/password";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const check = validatePassword(next);
  const passed = RULES.filter((r) => r.test(next)).length;
  const colors = ["bg-red-400", "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-emerald-500"];
  const labels = ["", "Très faible", "Faible", "Moyen", "Fort", "Très fort"];
  const labelColors = ["", "text-red-500", "text-red-500", "text-orange-500", "text-amber-500", "text-emerald-600"];
  const mismatch = confirm.length > 0 && next !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!check.valid) { setMsg({ type: "error", text: `Mot de passe trop faible — requis : ${check.errors.join(", ")}.` }); return; }
    if (next !== confirm) { setMsg({ type: "error", text: "Les mots de passe ne correspondent pas." }); return; }

    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      setMsg({ type: "success", text: "Mot de passe mis à jour avec succès." });
      setCurrent(""); setNext(""); setConfirm("");
    } else {
      setMsg({ type: "error", text: data.error ?? "Une erreur est survenue." });
    }
  }

  const fieldClass = "w-full h-11 px-3.5 pr-11 rounded-xl border border-[#D2D2D7] bg-white text-[14px] text-[#1D1D1F] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-[#8E8E93]" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Changer le mot de passe</h2>
          <p className="text-[13px] text-[#6E6E73]">Choisissez un mot de passe fort et unique.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mot de passe actuel */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Mot de passe actuel</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              placeholder="••••••••"
              className={fieldClass}
            />
            <button type="button" onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1D1D1F] transition-colors">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="h-px bg-[#F5F5F7]" />

        {/* Nouveau mot de passe */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              placeholder="••••••••"
              className={fieldClass}
            />
            <button type="button" onClick={() => setShowNext((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1D1D1F] transition-colors">
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {next.length > 0 && (
            <div className="space-y-1.5 mt-2">
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
          )}
        </div>

        {/* Confirmation */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className={cn(fieldClass, "pr-3.5", mismatch && "border-red-400 focus:border-red-400 focus:ring-red-400/20")}
          />
          {mismatch && <p className="text-[12px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>}
        </div>

        {msg && (
          <div className={cn(
            "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-medium",
            msg.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-600"
          )}>
            {msg.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div className="pt-1">
          <button type="submit" disabled={loading || mismatch || !check.valid || !current}
            className="h-11 px-6 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors disabled:opacity-50">
            {loading ? "Enregistrement…" : "Mettre à jour"}
          </button>
        </div>
      </form>
    </div>
  );
}
