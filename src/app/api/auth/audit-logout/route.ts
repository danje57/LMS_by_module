import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function POST() {
  const session = await auth();
  if (session?.user?.id) {
    await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "auth.logout" });
  }
  return NextResponse.json({ ok: true });
}
