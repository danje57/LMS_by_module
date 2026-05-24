"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  { value: "orange", label: "Avertissement", bg: "bg-amber-400", ring: "ring-amber-400" },
  { value: "red",    label: "Critique",       bg: "bg-red-500",   ring: "ring-red-500"   },
  { value: "blue",   label: "Information",    bg: "bg-sky-500",   ring: "ring-sky-500"   },
];

type Props = {
  current: {
    enabled: boolean;
    message: string | null;
    color: string;
    endsAt: string | null; // ISO string or null
  };
};

export function MaintenanceBannerForm({ current }: Props) {
  const [enabled, setEnabled]   = useState(current.enabled);
  const [message, setMessage]   = useState(current.message ?? "");
  const [color, setColor]       = useState(current.color ?? "orange");
  const [endsAt, setEndsAt]     = useState(current.endsAt ? current.endsAt.slice(0, 16) : "");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setSuccess(false);
    setError(null);
    const res = await fetch("/api/admin/branding/maintenance-banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maintenanceBannerEnabled: enabled,
        maintenanceBannerMessage: message.trim() || null,
        maintenanceBannerColor: color,
        maintenanceBannerEndsAt: endsAt ? new Date(endsAt).toISOString() : null,
      }),
    });
    setLoading(false);
    if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Erreur"); }
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-5">

      {/* Header + toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Bannière de maintenance</h3>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
              Affichée à tous les utilisateurs connectés, en priorité sur le thème saisonnier.
            </p>
          </div>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          aria-pressed={enabled}
          className={cn(
            "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
            enabled ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#48484A]"
          )}
        >
          <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200", enabled && "translate-x-6")} />
        </button>
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Message</label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex : Maintenance prévue ce soir de 22h à 23h."
          className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
        />
      </div>

      {/* Couleur */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Type</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-medium transition-all",
                color === c.value
                  ? "border-[#0071E3] bg-[#F0F7FF] dark:bg-[#0071E3]/10 text-[#0071E3]"
                  : "border-[#E5E5EA] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#0071E3]/40"
              )}
            >
              <span className={cn("w-3 h-3 rounded-full shrink-0", c.bg)} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date de fin */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
          Fin prévue <span className="font-normal text-[#ADADB8]">(optionnel)</span>
        </label>
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
        />
        {endsAt && (
          <button onClick={() => setEndsAt("")} className="text-[12px] text-[#ADADB8] hover:text-[#6E6E73] transition-colors">
            Effacer la date
          </button>
        )}
      </div>

      {/* Preview */}
      {enabled && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px]",
          color === "orange" && "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300",
          color === "red"    && "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300",
          color === "blue"   && "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-300",
        )}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{message.trim() || "Maintenance en cours"}</span>
          {endsAt && <span className="opacity-75 ml-auto text-[11px]">Fin le {new Date(endsAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />Bannière mise à jour.
        </div>
      )}

      <button
        onClick={save}
        disabled={loading}
        className="px-5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
