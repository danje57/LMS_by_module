"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentTheme } from "@/lib/seasonal-theme";

export function SeasonalBanner() {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const theme = getCurrentTheme();

  useEffect(() => {
    if (!theme) return;
    const key = `seasonal-dismissed-${theme.key}`;
    const isDismissed = localStorage.getItem(key) === "1";
    setDismissed(isDismissed);
  }, [theme?.key]);

  if (!theme || dismissed) return null;

  function dismiss() {
    if (!theme) return;
    localStorage.setItem(`seasonal-dismissed-${theme.key}`, "1");
    setDismissed(true);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border bg-gradient-to-r",
        theme.gradient,
        theme.borderColor,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none select-none">{theme.emoji}</span>
        <div>
          <p className={cn("text-[13px] font-semibold", theme.textColor)}>{theme.label}</p>
          <p className={cn("text-[12px] opacity-80", theme.textColor)}>{theme.message}</p>
        </div>
      </div>
      <button
        onClick={dismiss}
        className={cn("p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity shrink-0", theme.textColor)}
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
