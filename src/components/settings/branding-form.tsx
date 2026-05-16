"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandingSetting } from "@prisma/client";
import { CheckCircle, AlertCircle } from "lucide-react";

interface BrandingFormProps {
  branding: BrandingSetting | null;
}

export function BrandingForm({ branding }: BrandingFormProps) {
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
      setMessage({ type: "success", text: "Branding mis à jour." });
      // Rafraîchit les server components (sidebar, login) sans recharger la page entière
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error ?? "Une erreur est survenue." });
    }
    setLoading(false);
  }

  const fieldClass = "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] bg-white text-[15px] text-[#1D1D1F] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";
  const labelClass = "block text-[13px] font-medium text-[#1D1D1F] mb-1.5";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 space-y-6">
      <div>
        <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Branding</h2>
        <p className="text-[13px] text-[#6E6E73] mt-0.5">
          Personnalisez l&apos;apparence de votre application.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="appName" className={labelClass}>Nom de l&apos;application</label>
          <input
            id="appName" name="appName" required maxLength={100}
            defaultValue={branding?.appName ?? "LMS"}
            className={fieldClass}
          />
        </div>

        <div className="h-px bg-[#F5F5F7]" />

        <div>
          <label htmlFor="logo" className={labelClass}>Logo</label>
          <p className="text-[12px] text-[#6E6E73] mb-2">PNG, SVG ou JPG · max 2 Mo</p>
          <input id="logo" name="logo" type="file" accept="image/*"
            className="w-full text-[13px] text-[#6E6E73] file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-[13px] file:font-medium file:bg-[#F5F5F7] file:text-[#1D1D1F] hover:file:bg-[#E5E5EA] cursor-pointer" />
          {branding?.logoPath && (
            <p className="text-[12px] text-[#ADADB8] mt-1.5">
              Actuel : {branding.logoPath.split("/").pop()}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="banner" className={labelClass}>Bannière de login</label>
          <p className="text-[12px] text-[#6E6E73] mb-2">PNG ou JPG · max 5 Mo</p>
          <input id="banner" name="banner" type="file" accept="image/*"
            className="w-full text-[13px] text-[#6E6E73] file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-[13px] file:font-medium file:bg-[#F5F5F7] file:text-[#1D1D1F] hover:file:bg-[#E5E5EA] cursor-pointer" />
          {branding?.bannerPath && (
            <p className="text-[12px] text-[#ADADB8] mt-1.5">
              Actuel : {branding.bannerPath.split("/").pop()}
            </p>
          )}
        </div>

        {message && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
            message.type === "success"
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-red-50 border-red-100 text-red-600"
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
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
