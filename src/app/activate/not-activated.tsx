"use client";

import { signOut } from "next-auth/react";

export function NotActivatedPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg p-8 text-center space-y-5">
        <div className="text-4xl">⏳</div>
        <div className="space-y-2">
          <h1 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Service temporairement indisponible
          </h1>
          <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">
            L&apos;accès à l&apos;application est momentanément suspendu.<br />
            Contactez votre administrateur.
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/audit-logout", { method: "POST" }).catch(() => {});
            await signOut({ callbackUrl: "/login" });
          }}
          className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] text-[14px] font-medium py-2.5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
