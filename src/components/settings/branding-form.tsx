"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandingSetting } from "@prisma/client";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface BrandingFormProps {
  branding: BrandingSetting | null;
}

export function BrandingForm({ branding }: BrandingFormProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/branding", { method: "POST", body: form });

    if (res.ok) {
      setMessage({ type: "success", text: t("brandingUpdated") });
      // Rafraîchit les server components (sidebar, login) sans recharger la page entière
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error ?? "Une erreur est survenue." });
    }
    setLoading(false);
  }

  const fieldClass = "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";
  const labelClass = "block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5";

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-7 space-y-6">
      <div>
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("branding")}</h2>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("brandingDesc")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="appName" className={labelClass}>{t("appName")}</label>
          <input
            id="appName" name="appName" required maxLength={100}
            defaultValue={branding?.appName ?? "LMS"}
            className={fieldClass}
          />
        </div>

        <div className="h-px bg-[#F5F5F7] dark:bg-[#3A3A3C]" />

        <div>
          <label htmlFor="logo" className={labelClass}>{t("logo")}</label>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mb-2">{t("logoFormats")}</p>
          <input id="logo" name="logo" type="file" accept="image/*"
            className="w-full text-[13px] text-[#6E6E73] dark:text-[#8E8E93] file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-[13px] file:font-medium file:bg-[#F5F5F7] dark:file:bg-[#2C2C2E] file:text-[#1D1D1F] dark:file:text-[#F5F5F7] hover:file:bg-[#E5E5EA] dark:hover:file:bg-[#3A3A3C] cursor-pointer" />
          {branding?.logoPath && (
            <p className="text-[12px] text-[#ADADB8] mt-1.5">
              {t("currentFile", { filename: branding.logoPath.split("/").pop() ?? "" })}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="loginNotice" className={labelClass}>{t("loginNotice")}</label>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mb-2">
            {t("loginNoticeDesc")}
          </p>
          <textarea
            id="loginNotice"
            name="loginNotice"
            rows={4}
            maxLength={1000}
            defaultValue={branding?.loginNotice ?? ""}
            placeholder="Ex : Cette application est la propriété de Noelse. Tout utilisateur n'appartenant pas au groupe n'est pas autorisé d'accès."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 resize-none placeholder:text-[#ADADB8]"
          />
        </div>

        {message && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
            message.type === "success"
              ? "bg-green-50 dark:bg-emerald-500/10 border-green-100 dark:border-emerald-500/20 text-green-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600"
          }`}>
            {message.type === "success"
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <p className="text-[13px] font-medium">{message.text}</p>
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[15px] font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
