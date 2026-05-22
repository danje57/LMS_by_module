import { auth } from "@/lib/auth";
import { getMailConfig } from "@/lib/mail-config";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const config = await getMailConfig();
  if (!config.cronSecret) return NextResponse.json({ error: "Secret cron non configuré." }, { status: 400 });

  const base = new URL(req.url).origin;
  const res = await fetch(`${base}/api/cron/notifications`, {
    headers: { Authorization: `Bearer ${config.cronSecret}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
