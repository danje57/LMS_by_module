"use client";

import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LogOut } from "lucide-react";

interface HeaderProps {
  session: Session;
}

export function Header({ session }: HeaderProps) {
  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 bg-white border-b border-[#E5E5EA] flex items-center justify-end px-6 gap-3 shrink-0">
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-[#0071E3] flex items-center justify-center">
          <span className="text-[11px] font-semibold text-white">{initials}</span>
        </div>
        <span className="text-[13px] text-[#3C3C43] font-medium">
          {session.user.name ?? session.user.email}
        </span>
      </div>

      <div className="w-px h-4 bg-[#E5E5EA]" />

      <button
        onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
        className="flex items-center gap-1.5 text-[13px] text-[#8E8E93] hover:text-[#1D1D1F] transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Déconnexion
      </button>
    </header>
  );
}
