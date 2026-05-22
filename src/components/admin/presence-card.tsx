"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Users, X, Clock, BookOpen, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveUser = {
  userId: string;
  name: string;
  email: string;
  courseId: string;
  courseTitle: string;
  lastAccessAt: string;
};

export function PresenceCard() {
  const t = useTranslations("presence");
  const [count, setCount] = useState<number | null>(null);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/presence");
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.count);
      setUsers(data.users);
      setLastRefresh(new Date());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  function formatAgo(iso: string) {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}min`;
  }

  return (
    <>
      <button
        onClick={() => { setModalOpen(true); refresh(); }}
        className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4 text-left hover:border-[#0071E3]/40 hover:shadow-sm transition-all w-full"
      >
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          {count !== null && count > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("live")}
            </span>
          )}
        </div>
        <div>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{t("title")}</p>
          <p className="text-[32px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-1">
            {count ?? "—"}
          </p>
          {lastRefresh && (
            <p className="text-[12px] text-[#ADADB8] mt-1">
              {t("updatedAgo", { ago: formatAgo(lastRefresh.toISOString()) })}
            </p>
          )}
        </div>
      </button>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{t("modalTitle")}</p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{t("modalSubtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg",
                  count && count > 0
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                    : "text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E]"
                )}>
                  {count && count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {count ?? 0} {t("online")}
                </span>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
                >
                  <X className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-3">
                    <Users className="w-5 h-5 text-[#ADADB8]" />
                  </div>
                  <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("noOneOnline")}</p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">{t("noOneOnlineDesc")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.userId} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-[#0071E3] flex items-center justify-center">
                          <span className="text-[12px] font-semibold text-white">
                            {u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1C1C1E]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{u.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <BookOpen className="w-3 h-3 text-[#0071E3] shrink-0" />
                          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] truncate">{u.courseTitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#ADADB8] shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatAgo(u.lastAccessAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-between">
              <p className="text-[11px] text-[#ADADB8]">{t("refreshInfo")}</p>
              <button
                onClick={refresh}
                className="text-[12px] text-[#0071E3] hover:underline font-medium"
              >
                {t("refreshNow")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
