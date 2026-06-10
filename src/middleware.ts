import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Routes publiques sans authentification
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/public/")
  ) {
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Toutes les autres routes nécessitent une session
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // /activate et son API sont toujours accessibles (licence expirée ou renouvellement en cours)
  if (
    pathname.startsWith("/activate") ||
    pathname.startsWith("/api/admin/license")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/|h5p-standalone/|pdf\\.worker\\.min\\.mjs).*)"],
};
