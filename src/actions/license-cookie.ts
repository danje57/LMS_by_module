"use server";

import { cookies } from "next/headers";

export async function setLicenseCookieAction(expiresAt: string | null) {
  const cookieStore = await cookies();
  const expires = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  cookieStore.set("lms-lic", "1", {
    expires,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function clearLicenseCookieAction() {
  const cookieStore = await cookies();
  cookieStore.delete("lms-lic");
}
