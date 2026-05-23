import { NextRequest, NextResponse } from "next/server";
import { createBackup, pruneOldBackups } from "@/lib/backup";
import { getMailConfig } from "@/lib/mail-config";

// Protégé par CRON_SECRET — exemple d'appel système :
//   0 2 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/backup?keep=10"
export async function GET(req: NextRequest) {
  const mailCfg = await getMailConfig();
  const secret = mailCfg.cronSecret;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const keep = parseInt(req.nextUrl.searchParams.get("keep") ?? "10", 10);

  try {
    const result = await createBackup({ notes: "Backup automatique (cron)" });
    const pruned = await pruneOldBackups(isNaN(keep) || keep < 1 ? 10 : keep);
    return NextResponse.json({ ok: true, filename: result.filename, sizeBytes: result.sizeBytes, pruned });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
