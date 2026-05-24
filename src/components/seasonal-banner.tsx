"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentTheme } from "@/lib/seasonal-theme";

export function SeasonalBanner({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const theme = getCurrentTheme();

  useEffect(() => {
    if (!theme) return;
    const key = `seasonal-dismissed-${theme.key}`;
    setDismissed(localStorage.getItem(key) === "1");
  }, [theme?.key]);

  if (!enabled || !theme || dismissed) return null;

  function dismiss() {
    if (!theme) return;
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
