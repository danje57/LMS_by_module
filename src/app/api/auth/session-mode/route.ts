import { NextRequest, NextResponse } from "next/server";
import { auth, updateSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { mode } = await req.json() as { mode: "admin" | "user" };
  if (mode !== "admin" && mode !== "user") {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }

  // Seul un utilisateur avec le rôle admin peut activer le mode admin
  if (mode === "admin" && !session.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await updateSession({ sessionMode: mode } as Parameters<typeof updateSession>[0]);
  return NextResponse.json({ ok: true });
}
