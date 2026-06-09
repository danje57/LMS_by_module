"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import type { Session } from "next-auth";
import { useTranslations } from "next-intl";
import { LogOut, ShieldCheck, ShieldOff, X, TriangleAlert, ShieldAlert, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";

interface HeaderProps {
  session: Session;
}

export function Header({ session }: HeaderProps) {
  const [pendingMode, setPendingMode] = useState<"admin" | "user" | null>(null);
  const [password, setPassword]       = useState("");
  const [pwdError, setPwdError]       = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("header");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdminMode = session.user.sessionMode === "admin";
  const hasAdminRole = session.user.roles.includes("admin") || session.user.roles.includes("superadmin");

  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function openAdminModal() {
    setPassword("");
    setPwdError("");
    setShowPwd(false);
    setPendingMode("admin");
  }

  async function applyMode(mode: "admin" | "user") {
    setPwdError("");
    setLoading(true);
    const res = await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ...(mode === "admin" ? { password } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setPwdError(data.error ?? "Erreur inconnue");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
        </div>
      )}

      <header className="h-14 bg-white dark:bg-[#111114] border-b border-[#E5E5EA] dark:border-[#2C2C30] flex items-center justify-end px-6 gap-3 shrink-0">

        {hasAdminRole && (
          <button
            onClick={() => isAdminMode ? setPendingMode("user") : openAdminModal()}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 h-8 px-3 rounded-xl text-[13px] font-medium border transition-all disabled:opacity-50",
              isAdminMode
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "bg-[#F5F5F7] dark:bg-[#1C1C20] border-[#E5E5EA] dark:border-[#2C2C30] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:border-[#D2D2D7]"
            )}
          >
            {isAdminMode
              ? <><ShieldCheck className="w-3.5 h-3.5" />{t("adminMode")}</>
              : <><ShieldOff className="w-3.5 h-3.5" />{t("adminMode")}</>
            }
          </button>
        )}

        <NotificationBell />

        <div className="w-px h-4 bg-[#E5E5EA] dark:bg-[#2C2C30]" />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] transition-colors"
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              isAdminMode ? "bg-red-500" : "bg-[#0071E3]"
            )}>
              <span className="text-[11px] font-semibold text-white">{initials}</span>
            </div>
            <span className="text-[13px] text-[#3C3C43] dark:text-[#AEAEB2] font-medium">
              {session.user.name ?? session.user.email}
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#1C1C20] border border-[#E5E5EA] dark:border-[#2C2C30] rounded-xl shadow-lg py-1 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C30] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#6E6E73]" />
                {t("myProfile")}
              </Link>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-[#E5E5EA] dark:bg-[#2C2C30]" />

        <button
          onClick={async () => {
            await fetch("/api/auth/audit-logout", { method: "POST" });
            await signOut({ redirect: false });
            window.location.href = "/login";
          }}
          className="flex items-center gap-1.5 text-[13px] text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t("logout")}
        </button>
      </header>

      {pendingMode === "admin" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C20] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <TriangleAlert className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("activateAdmin")}</p>
              </div>
              <button onClick={() => setPendingMode(null)} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
                <X className="w-4 h-4 text-[#6E6E73]" />
              </button>
            </div>
            <p className="text-[13px] text-[#6E6E73] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: t.raw("activateAdminDesc") as string }}
            />
            {/* Champ mot de passe */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#3C3C43] dark:text-[#AEAEB2]">
                Confirmez votre mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwdError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && password && applyMode("admin")}
                  placeholder="Votre mot de passe"
                  autoFocus
                  className={cn(
                    "w-full h-10 rounded-xl border px-3 pr-10 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] bg-white dark:bg-[#2C2C2E] placeholder-[#ADADB8] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-colors",
                    pwdError
                      ? "border-red-400 dark:border-red-500"
                      : "border-[#D2D2D7] dark:border-[#3A3A3C]"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ADADB8] hover:text-[#6E6E73] transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwdError && (
                <p className="text-[12px] text-red-500">{pwdError}</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPendingMode(null)}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C30] transition-colors">
                {t("cancel")}
              </button>
              <button
                onClick={() => applyMode("admin")}
                disabled={loading || !password}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-medium disabled:opacity-50 transition-colors">
                {loading ? "Vérification…" : t("activate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingMode === "user" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C20] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-[#6E6E73]" />
                </div>
                <p className="text-[15px] font-semibold text-[#1D1D1F]">{t("exitAdmin")}</p>
              </div>
              <button onClick={() => setPendingMode(null)} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
                <X className="w-4 h-4 text-[#6E6E73]" />
              </button>
            </div>
            <p className="text-[13px] text-[#6E6E73] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: t.raw("exitAdminDesc") as string }}
            />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPendingMode(null)}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C30] transition-colors">
                {t("cancel")}
              </button>
              <button onClick={() => applyMode("user")} disabled={loading}
                className="flex-1 h-10 rounded-xl bg-[#1D1D1F] hover:bg-[#3C3C43] text-white text-[14px] font-medium disabled:opacity-50 transition-colors">
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
