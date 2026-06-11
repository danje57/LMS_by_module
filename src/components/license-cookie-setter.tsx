"use client";

import { useEffect } from "react";
import { setLicenseCookieAction } from "@/actions/license-cookie";

export function LicenseCookieSetter({ expiresAt }: { expiresAt: string | null }) {
  useEffect(() => {
    setLicenseCookieAction(expiresAt).catch(() => {});
  }, [expiresAt]);
  return null;
}
