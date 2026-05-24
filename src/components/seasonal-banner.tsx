"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentTheme } from "@/lib/seasonal-theme";

// Preview dates indexed by theme key
const PREVIEW_DATES: Record<string, Date> = {
  "nouvel-an":        new Date(2026, 0, 1),
  "carnaval":         new Date(2026, 1, 17),  // Mardi Gras 2026
  "paques":           new Date(2026, 3, 5),   // Pâques 2026
  "fete-travail":     new Date(2026, 4, 1),
  "fete-nationale-lu":new Date(2026, 5, 23),
  "fete-nationale-fr":new Date(2026, 6, 14),
  "rentree":          new Date(2026, 8, 1),
  "halloween":        new Date(2026, 9, 31),
  "toussaint":        new Date(2026, 10, 1),
  "noel":             new Date(2026, 11, 25),
};

export function SeasonalBanner({ enabled }: { enabled: boolean }) {
  const searchParams = useSearchParams();
  const previewKey = searchParams.get("preview");
  const previewDate = previewKey ? PREVIEW_DATES[previewKey] : undefined;
  const isPreview = Boolean(previewDate);

  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const theme = getCurrentTheme(previewDate);

  useEffect(() => {
    if (!theme) return;
    if (isPreview) { setDismissed(false); return; }
    const key = `seasonal-dismissed-${theme.key}`;
    const isDismissed = localStorage.getItem(key) === "1";
    setDismissed(isDismissed);
  }, [theme?.key, isPreview]);

  if (!enabled || !theme || dismissed) return null;

  function dismiss() {
    if (!theme || isPreview) return;
    localStorage.setItem(`seasonal-dismissed-${theme.key}`, "1");
    setDismissed(true);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border bg-gradient-to-r",
        theme.gradient,
        theme.borderColor,
      )}
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl leading-none select-none">{theme.emoji}</span>
        <div>
          <p className={cn("text-[15px] font-semibold", theme.textColor)}>{theme.label}</p>
          <p className={cn("text-[13px] opacity-80", theme.textColor)}>{theme.message}</p>
        </div>
      </div>
      <button
        onClick={dismiss}
        className={cn("p-2 rounded-lg opacity-50 hover:opacity-100 transition-opacity shrink-0", theme.textColor)}
        aria-label="Fermer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
