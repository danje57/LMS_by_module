"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { days: 30,  label: "30 jours" },
  { days: 60,  label: "2 mois" },
  { days: 90,  label: "3 mois" },
  { days: 180, label: "6 mois (défaut)" },
  { days: 365, label: "1 an" },
  { days: 0,   label: "Illimité (pas de purge)" },
];

export function RetentionSettingsForm({ current }: { current: number }) {
  const isCustom = !OPTIONS.some((o) => o.days === current);
  const [selected, setSelected] = useState(isCustom ? -1 : current);
  const [custom, setCustom] = useState(isCustom ? String(current) : "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDays = selected === -1 ? parseInt(custom || "0", 10) : selected;
  const isValid = selected !== -1 || (parseInt(custom, 10) > 0 && !isNaN(parseInt(custom, 10)));

  async function save() {
    setLoading(true);
    setSuccess(false);
    setError(null);
    const res = await fetch("/api/admin/retention", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogRetentionDays: effectiveDays }),
    });
    setLoading(false);
    if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    else { const d = await res.json(); setError(d.error ?? "Erreur"); }
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Rétention des logs d'activité</h3>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
            Les logs plus anciens seront purgés automatiquement. Paramètre RGPD.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => { setSelected(opt.days); setCustom(""); }}
            className={cn(
              "px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-all text-left",
              selected === opt.days
                ? "bg-[#0071E3] border-[#0071E3] text-white"
                : "bg-[#F5F5F7] dark:bg-[#2C2C2E] border-transparent text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#0071E3]/40"
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setSelected(-1)}
          className={cn(
            "px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-all text-left",
            selected === -1
              ? "bg-[#0071E3] border-[#0071E3] text-white"
              : "bg-[#F5F5F7] dark:bg-[#2C2C2E] border-transparent text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#0071E3]/40"
          )}
        >
          Personnalisé…
        </button>
      </div>

      {selected === -1 && (
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="3650"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex : 75"
            className="w-32 h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
            autoFocus
          />
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">jours</span>
        </div>
      )}

      {selected === 0 && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
          Attention : aucune purge automatique. Les logs s'accumuleront indéfiniment.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />Rétention mise à jour.
        </div>
      )}

      <button
        onClick={save}
        disabled={loading || !isValid || effectiveDays === current}
        className="px-5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
