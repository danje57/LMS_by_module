import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBackup, restoreBackup } from "@/lib/backup";
import { auditLog } from "@/lib/audit";
import fs from "fs";
import path from "path";
import os from "os";

// POST — restaurer depuis un fichier zip uploadé (admin uniquement, déverrouillé par mot de passe côté UI)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  let tmpZipPath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    if (!file.name.endsWith(".zip")) return NextResponse.json({ error: "Le fichier doit être un .zip" }, { status: 400 });

    // Écrire le zip uploadé dans un fichier temporaire
    const buffer = Buffer.from(await file.arrayBuffer());
    tmpZipPath = path.join(os.tmpdir(), `lms-restore-${Date.now()}.zip`);
    fs.writeFileSync(tmpZipPath, buffer);

    // Backup de sécurité avant restauration
    await createBackup({
      notes: "Backup automatique avant restauration",
      createdBy: session.user.name ?? session.user.email,
    });

    // Restauration
    await restoreBackup(tmpZipPath);

    await auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "backup.restore",
      targetLabel: file.name,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    if (tmpZipPath && fs.existsSync(tmpZipPath)) fs.rmSync(tmpZipPath, { force: true });
  }
}
