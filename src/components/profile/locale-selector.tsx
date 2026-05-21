"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocaleSelectorProps {
  currentLocale: "fr" | "en";
}

export function LocaleSelector({ currentLocale }: LocaleSelectorProps) {
  const t = useTranslations("profile");
  const [locale, setLocale] = useState<"fr" | "en">(currentLocale);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(value: "fr" | "en") {
    if (value === locale) return;
    setLocale(value);
    setLoading(true);
    setSaved(false);
    await fetch("/api/user/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: value }),
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-[#8E8E93]" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">{t("language")}</h2>
          <p className="text-[13px] text-[#6E6E73]">{t("languageDesc")}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["fr", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => handleChange(l)}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14px] font-medium transition-all disabled:opacity-50",
              locale === l
                ? "bg-[#0071E3] border-[#0071E3] text-white"
                : "bg-white border-[#D2D2D7] text-[#3C3C43] hover:border-[#0071E3]/40"
            )}
          >
            <span>{l === "fr" ? "🇫🇷" : "🇬🇧"}</span>
            {l === "fr" ? t("french") : t("english")}
          </button>
        ))}
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600">
          <CheckCircle className="w-4 h-4" />
          {t("languageSaved")}
        </div>
      )}
    </div>
  );
}
