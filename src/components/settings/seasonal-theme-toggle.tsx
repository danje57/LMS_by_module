"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function SeasonalThemeToggle({ current }: { current: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(current);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(value: boolean) {
    setLoading(true);
    setSuccess(false);
    setError(null);
    const res = await fetch("/api/admin/branding/seasonal-theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonalThemesEnabled: value }),
    });
    setLoading(false);
    if (res.ok) {
      setEnabled(value);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Erreur");
    }
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Thèmes saisonniers</h3>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
              Affiche une bannière festive sur le tableau de bord selon la période de l'année.
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => !loading && toggle(!enabled)}
          disabled={loading}
          aria-pressed={enabled}
          className={cn(
            "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]",
            enabled ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#48484A]",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
              enabled && "translate-x-6"
            )}
          />
        </button>
      </div>

      {enabled && (
        <p className="text-[12px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-xl px-3 py-2">
          Actif — la bannière apparaît automatiquement lors des fêtes et événements de l'année.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />Paramètre enregistré.
        </div>
      )}
    </div>
  );
}
