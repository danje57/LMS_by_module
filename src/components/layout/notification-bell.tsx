"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BookOpen, Clock, CircleCheck, X, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  course_assigned:        <BookOpen className="w-4 h-4 text-[#0071E3]" />,
  deadline_warning:       <Clock className="w-4 h-4 text-amber-500" />,
  course_completed:       <CircleCheck className="w-4 h-4 text-emerald-500" />,
  license_expiry_warning: <ShieldAlert className="w-4 h-4 text-red-500" />,
};

const TYPE_BG: Record<string, string> = {
  course_assigned:        "bg-blue-50 dark:bg-[#0071E3]/10",
  deadline_warning:       "bg-amber-50 dark:bg-amber-500/10",
  course_completed:       "bg-emerald-50 dark:bg-emerald-500/10",
  license_expiry_warning: "bg-red-50 dark:bg-red-500/10",
};

export function NotificationBell() {
  const [notifs, setNotifs]       = useState<Notif[]>([]);
  const [unread, setUnread]       = useState(0);
  const [open, setOpen]           = useState(false);
  const ref                       = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notif[]; unreadCount: number };
      setNotifs(data.notifications);
      setUnread(data.unreadCount);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
      setUnread(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-[#1C1C20] border border-[#E5E5EA] dark:border-[#2C2C30] rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F5F7] dark:border-[#2C2C30]">
            <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Notifications</p>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C30] transition-colors">
              <X className="w-3.5 h-3.5 text-[#6E6E73]" />
            </button>
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-[#D2D2D7] mx-auto mb-2" />
              <p className="text-[13px] text-[#8E8E93]">Aucune notification</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-[#F5F5F7] dark:divide-[#2C2C30]">
              {notifs.map((n) => {
                const content = (
                  <div className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C30]", !n.read && "bg-blue-50/40 dark:bg-[#0071E3]/5")}>
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", TYPE_BG[n.type] ?? "bg-[#F5F5F7] dark:bg-[#2C2C2E]")}>
                      {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-[#6E6E73]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">{n.title}</p>
                      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-[#ADADB8] dark:text-[#636366] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-[#0071E3] rounded-full shrink-0 mt-2" />}
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{content}</Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
