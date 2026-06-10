import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateLicense } from "@/lib/license-verify";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.sessionMode !== "admin") return NextResponse.json({ error: "Mode admin requis" }, { status: 403 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const result = await activateLicense(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "license.activate",
    targetLabel: "Activation licence",
  });

  return NextResponse.json({ ok: true });
}
