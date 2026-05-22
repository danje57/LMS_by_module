"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Sun, Moon, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

interface ThemeSelectorProps {
  currentTheme: Theme;
}

const options: { value: Theme; icon: React.ElementType; labelKey: "light" | "dark" | "system" }[] = [
  { value: "light", icon: Sun, labelKey: "light" },
  { value: "dark", icon: Moon, labelKey: "dark" },
  { value: "system", icon: Monitor, labelKey: "system" },
];

export function ThemeSelector({ currentTheme }: ThemeSelectorProps) {
  const t = useTranslations("profile");
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(value: Theme) {
    if (value === theme) return;
    setTheme(value);
    setLoading(true);
    setSaved(false);

    document.documentElement.classList.remove("dark");
    if (value === "dark") {
      document.documentElement.classList.add("dark");
    } else if (value === "system") {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      }
    }

    await fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: value }),
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-7 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
          <Monitor className="w-4 h-4 text-[#8E8E93]" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("themeTitle")}</h2>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t("themeDesc")}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {options.map(({ value, icon: Icon, labelKey }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14px] font-medium transition-all disabled:opacity-50",
              theme === value
                ? "bg-[#0071E3] border-[#0071E3] text-white"
                : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#3C3C43] dark:text-[#EBEBF5] hover:border-[#0071E3]/40"
            )}
          >
            <Icon className="w-4 h-4" />
            {t(`theme_${labelKey}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          {t("themeSaved")}
        </div>
      )}
    </div>
  );
}
