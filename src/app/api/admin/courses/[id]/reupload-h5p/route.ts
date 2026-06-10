import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import { encryptBuffer, signManifest } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";
import path from "path";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdirSync } from "fs";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const SCRIPTS_DIR = process.env.SCRIPTS_DIR ?? "./scripts";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  if (course.courseType !== "h5p") return NextResponse.json({ error: "Ce cours n'est pas un cours H5P" }, { status: 400 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const force = formData.get("force") === "true";
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".h5p")) return NextResponse.json({ error: "Seuls les fichiers .h5p sont acceptés" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha1").update(buffer).digest("hex");

    if (!force) {
      const existing = await prisma.course.findFirst({ where: { fileHash, isActive: true, id: { not: id } } });
      if (existing) return NextResponse.json({ duplicate: true, existingTitle: existing.title, existingId: existing.id });
    }

    const courseHash = fileHash.slice(0, 12);
    const courseDir = path.join(UPLOAD_DIR, "courses", courseHash);
    await mkdir(courseDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalPath = path.join(courseDir, safeName);
    // Thumbnail avant chiffrement
    let thumbnailPath: string | null = null;
    try {
      const thumbDir = path.join(UPLOAD_DIR, "thumbnails");
      mkdirSync(thumbDir, { recursive: true });
      const thumbDest = path.join(thumbDir, `${id}.jpg`);
      const scriptPath = path.resolve(SCRIPTS_DIR, "generate_h5p_thumbnail.py");
      // Écrire temporairement en clair pour le script Python
      await writeFile(finalPath, buffer);
      await execFileAsync("python3", [scriptPath, finalPath, thumbDest], { timeout: 30_000 });
      thumbnailPath = `thumbnails/${id}.jpg`;
    } catch { /* thumbnail non critique */ }

    // Chiffrement
    let encryptedKey: string | null = null;
    let licenseEncryptedKey: string | null = null;
    let contentLicenseId: string | null = null;
    let contentManifest: string | null = null;
    try {
      const { encrypted, encryptedKey: ek, fileKeyHex } = await encryptBuffer(buffer);
      await writeFile(finalPath, encrypted);
      encryptedKey = ek;
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      if (envelope) { licenseEncryptedKey = envelope.licenseEncryptedKey; contentLicenseId = envelope.contentLicenseId; }
      const manifest = await signManifest({
        courseId: id,
        contentHash: fileHash,
        createdBy: session.user.id,
        createdAt: new Date().toISOString(),
        instanceId: "",
      });
      contentManifest = manifest;
    } catch {
      // Si chiffrement échoue, écrire en clair
      await writeFile(finalPath, buffer);
    }

    const relPath = path.join("courses", courseHash, safeName);

    await prisma.course.update({
      where: { id },
      data: {
        filePath: relPath,
        originalFileName: file.name,
        fileSize: BigInt(buffer.byteLength),
        fileHash,
        isEncrypted: !!encryptedKey,
        encryptedKey,
        licenseEncryptedKey,
        contentLicenseId,
        contentManifest,
        ...(thumbnailPath ? { thumbnailPath } : {}),
      },
    });

    await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.reupload", targetId: id, targetLabel: course.title });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
