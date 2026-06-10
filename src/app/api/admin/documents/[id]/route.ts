import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { rm, rename, mkdir, readFile, writeFile } from "fs/promises";
import { encryptBuffer, signManifest } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";
import { createWriteStream } from "fs";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_PDF_SIZE = 100 * 1024 * 1024;

function parseMultipart(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { tmpPath: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_PDF_SIZE } });
    const fields: Record<string, string> = {};
    let fileResult: { tmpPath: string; originalName: string; size: number } | null = null;
    let busboyDone = false, writeDone = false, hasFile = false;

    function tryResolve() {
      if (busboyDone && (writeDone || !hasFile)) resolve({ fields, file: fileResult });
    }

    bb.on("field", (name, value) => { fields[name] = value; });

    bb.on("file", (_, stream, info) => {
      hasFile = true;
      if (!info.filename.toLowerCase().endsWith(".pdf")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .pdf sont acceptés"));
      }
      const tmpId = createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 12);
      const tmpDir = path.join(UPLOAD_DIR, "tmp");
      const tmpPath = path.join(tmpDir, `${tmpId}.pdf`);
      let size = 0;
      mkdir(tmpDir, { recursive: true }).then(() => {
        const ws = createWriteStream(tmpPath);
        stream.on("data", (chunk: Buffer) => { size += chunk.length; });
        stream.on("limit", () => reject(new Error("Fichier trop volumineux (max 100 Mo)")));
        stream.pipe(ws);
        ws.on("finish", () => { fileResult = { tmpPath, originalName: info.filename, size }; writeDone = true; tryResolve(); });
        ws.on("error", reject);
      }).catch(reject);
    });

    bb.on("finish", () => { busboyDone = true; tryResolve(); });
    bb.on("error", reject);
    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.course.findUnique({
    where: { id, courseType: "pdf" },
    select: { id: true, title: true, filePath: true, createdById: true },
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  if (!isAdmin && doc.createdById !== session.user.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  let tmpPath: string | null = null;
  try {
    const { fields, file } = await parseMultipart(req);
    tmpPath = file?.tmpPath ?? null;

    const title = fields.title?.trim();
    if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

    const category = isAdmin ? (fields.category?.trim() || null) : undefined;

    const updateData: Record<string, unknown> = { title };
    if (category !== undefined) updateData.category = category;

    if (file) {
      const fileHash = createHash("sha1")
        .update(`${file.originalName}-${file.size}`)
        .digest("hex");
      const destDir = path.join(UPLOAD_DIR, "documents");
      await mkdir(destDir, { recursive: true });
      const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${fileHash.slice(0, 8)}_${safeName}`;
      const finalPath = path.join(destDir, uniqueName);
      await rename(file.tmpPath, finalPath);
      tmpPath = null;

      // Supprimer l'ancien fichier
      try { await rm(path.join(UPLOAD_DIR, doc.filePath), { force: true }); } catch { /* non critique */ }

      // Chiffrement du nouveau fichier
      try {
        const plain = await readFile(finalPath);
        const { encrypted, encryptedKey, fileKeyHex } = await encryptBuffer(plain);
        await writeFile(finalPath, encrypted);
        const manifest = await signManifest({
          courseId: id,
          contentHash: fileHash,
          createdBy: session.user.id,
          createdAt: new Date().toISOString(),
          instanceId: "",
        });
        updateData.isEncrypted    = true;
        updateData.encryptedKey   = encryptedKey;
        updateData.contentManifest = manifest;
        const envelope = await buildLicenseEnvelope(fileKeyHex);
        if (envelope) {
          updateData.licenseEncryptedKey = envelope.licenseEncryptedKey;
          updateData.contentLicenseId   = envelope.contentLicenseId;
        }
      } catch { /* non critique */ }

      updateData.filePath         = path.join("documents", uniqueName);
      updateData.originalFileName = file.originalName;
      updateData.fileSize         = BigInt(file.size);
      updateData.fileHash         = fileHash;
      updateData.thumbnailPath    = null; // sera régénérée au prochain appel
    }

    await prisma.course.update({ where: { id }, data: updateData });

    // Régénération vignette si le PDF a changé
    if (file && updateData.filePath) {
      const newRelPath = updateData.filePath as string;
      import("@/lib/pdf-thumbnail").then(({ generateAndSavePdfThumbnail }) =>
        generateAndSavePdfThumbnail(id, newRelPath).then((thumbPath) =>
          prisma.course.update({ where: { id }, data: { thumbnailPath: thumbPath } })
        )
      ).catch(() => {});
    }

    await auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "document.edit",
      targetId: id,
      targetLabel: title,
      details: { fileReplaced: !!file },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (tmpPath) rm(tmpPath, { force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.course.findUnique({
    where: { id, courseType: "pdf" },
    select: { id: true, title: true, filePath: true, createdById: true },
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  if (!isAdmin && doc.createdById !== session.user.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  await prisma.course.update({ where: { id }, data: { isActive: false } });

  try {
    await rm(path.join(UPLOAD_DIR, doc.filePath), { force: true });
  } catch { /* non critique */ }

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "document.delete",
    targetId: doc.id,
    targetLabel: doc.title,
  });

  return NextResponse.json({ ok: true });
}
