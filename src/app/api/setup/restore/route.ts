import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { restoreBackup } from "@/lib/backup";
import fs from "fs";
import os from "os";
import path from "path";

async function adminExists() {
  const role = await prisma.role.findFirst({ where: { name: { in: ["superadmin", "admin"] } }, include: { users: { take: 1 } } });
  return role && role.users.length > 0;
}

// POST — restauration depuis l'écran setup (aucun admin existant requis)
export async function POST(req: NextRequest) {
  if (await adminExists())
    return NextResponse.json({ error: "Setup déjà effectué." }, { status: 403 });

  let tmpZipPath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    if (!file.name.endsWith(".zip")) return NextResponse.json({ error: "Le fichier doit être un .zip" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    tmpZipPath = path.join(os.tmpdir(), `lms-setup-restore-${Date.now()}.zip`);
    fs.writeFileSync(tmpZipPath, buffer);

    await restoreBackup(tmpZipPath);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    if (tmpZipPath && fs.existsSync(tmpZipPath)) fs.rmSync(tmpZipPath, { force: true });
  }
}
