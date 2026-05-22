"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError(t("invalidCredentials"));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("identifier")}
        </label>
        <input
          id="email"
          name="email"
          type="text"
          placeholder="admin"
          autoComplete="username"
          required
          className="w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-3.5 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          <p className="text-[13px] text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#006EDB] text-white text-[15px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
      >
        {loading ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
