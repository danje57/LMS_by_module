"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLicenseCookieAction } from "@/actions/license-cookie";

export function LicenseRedirect({ expiresAt }: { expiresAt: string | null }) {
  const router = useRouter();
  useEffect(() => {
    setLicenseCookieAction(expiresAt)
      .then(() => router.push("/dashboard"))
      .catch(() => router.push("/dashboard"));
  }, [expiresAt, router]);
  return null;
}
