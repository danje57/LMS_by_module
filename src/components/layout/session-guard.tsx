"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function SessionGuard({ userId }: { userId: string }) {
  const router = useRouter();
  const knownUserId = useRef(userId);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          // Session expired → back to login
          window.location.href = "/login";
          return;
        }
        const { id } = await res.json();
        if (id !== knownUserId.current) {
          // Different user logged in another tab → hard reload to pick up new session
          window.location.reload();
        }
      } catch {
        // Network error, ignore
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return null;
}
