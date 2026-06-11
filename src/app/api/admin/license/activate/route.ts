import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateLicense } from "@/lib/license-verify";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const roles = session.user.roles as unknown as string[] | undefined;
  const isAdmin = session.user.sessionMode === "admin" || roles?.includes("admin") || roles?.includes("superadmin");
  if (!isAdmin) return NextResponse.json({ error: "Droits admin requis" }, { status: 403 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const result = await activateLicense(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "license.activate",
    targetLabel: "Activation licence",
  });

  const res = NextResponse.json({ ok: true });
  const expires = result.expiresAt
    ? new Date(result.expiresAt)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  res.cookies.set("lms-lic", "1", { expires, path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
