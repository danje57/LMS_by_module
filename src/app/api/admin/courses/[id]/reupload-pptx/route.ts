import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createWriteStream, mkdirSync } from "fs";
import { rm, readdir, readFile, writeFile } from "fs/promises";
import { encryptBuffer, signManifest } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";
import path from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import { execFile } from "child_process";
import { promisify } from "util";
import AdmZip from "adm-zip";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const H5P_LIBS_DIR = process.env.H5P_LIBS_DIR ?? "./h5p-libraries";
const SCRIPTS_DIR = process.env.SCRIPTS_DIR ?? "./scripts";
const MAX_PPTX_SIZE = 200 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

function parsePptx(req: NextRequest): Promise<{ file: { path: string; originalName: string; size: number } | null; force: boolean }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_PPTX_SIZE } });
    let fileResult: { path: string; originalName: string; size: number } | null = null;
    let force = false;
    let busboyDone = false, writeDone = false, hasFile = false;

    function tryResolve() {
      if (busboyDone && (writeDone || !hasFile)) resolve({ file: fileResult, force });
    }

    bb.on("field", (name, value) => { if (name === "force") force = value === "true"; });
    bb.on("file", (_, stream, info) => {
      hasFile = true;
      const { filename } = info;
      if (!filename.toLowerCase().endsWith(".pptx")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .pptx sont acceptés"));
      }
      const hash = createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 12);
      const tmpDir = path.join(UPLOAD_DIR, "tmp");
      mkdirSync(tmpDir, { recursive: true });
      const pptxPath = path.join(tmpDir, `${hash}.pptx`);
      const ws = createWriteStream(pptxPath);
      let size = 0;
      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => reject(new Error("Fichier trop volumineux (max 200 Mo)")));
      stream.pipe(ws);
      ws.on("finish", () => { fileResult = { path: pptxPath, originalName: filename, size }; writeDone = true; tryResolve(); });
      ws.on("error", reject);
    });

    bb.on("finish", () => { busboyDone = true; tryResolve(); });
    bb.on("error", reject);
    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });
}

async function addLibrariesToZip(zip: AdmZip) {
  try {
    const entries = await readdir(path.resolve(H5P_LIBS_DIR), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      zip.addLocalFolder(path.join(path.resolve(H5P_LIBS_DIR), entry.name), entry.name);
    }
  } catch { /* pas de librairies externes */ }
}

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

  let pptxPath: string | null = null;
  let contentDir: string | null = null;

  try {
    const { file, force } = await parsePptx(req);
    if (!file) return NextResponse.json({ error: "Fichier PPTX manquant" }, { status: 400 });

    pptxPath = file.path;

    const pptxBuffer = await readFile(pptxPath);
    const fileHash = createHash("sha1").update(pptxBuffer).digest("hex");

    if (!force) {
      const existing = await prisma.course.findFirst({ where: { fileHash, isActive: true, id: { not: id } } });
      if (existing) {
        await rm(pptxPath, { force: true });
        pptxPath = null;
        return NextResponse.json({ duplicate: true, existingTitle: existing.title, existingId: existing.id });
      }
    }
    const hash = fileHash.slice(0, 12);

    contentDir = path.join(UPLOAD_DIR, "tmp", `converted_${hash}`);
    mkdirSync(contentDir, { recursive: true });

    const scriptPath = path.resolve(SCRIPTS_DIR, "pptx_to_h5p.py");
    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, pptxPath, contentDir, course.title], {
      timeout: 300_000,
    });

    let meta: { slideCount: number } | { error: string };
    try { meta = JSON.parse(stdout.trim()); }
    catch { throw new Error(`Script invalide: ${stdout} / ${stderr}`); }
    if ("error" in meta) throw new Error(meta.error);

    const courseDir = path.join(UPLOAD_DIR, "courses", hash);
    mkdirSync(courseDir, { recursive: true });

    const h5pFilename = course.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) + ".h5p";
    const h5pDest = path.join(courseDir, h5pFilename);

    const zip = new AdmZip();
    zip.addLocalFile(path.join(contentDir, "h5p.json"), "");
    zip.addLocalFolder(path.join(contentDir, "content"), "content");
    await addLibrariesToZip(zip);
    zip.writeZip(h5pDest);

    let thumbnailPath: string | null = null;
    try {
      const { copyFile } = await import("fs/promises");
      await copyFile(path.join(contentDir, "thumbnail.jpg"), path.join(courseDir, "thumbnail.jpg"));
      thumbnailPath = `courses/${hash}/thumbnail.jpg`;
    } catch { /* pas de thumbnail */ }

    // Chiffrement du .h5p généré
    let encryptedKey: string | null = null;
    let licenseEncryptedKey: string | null = null;
    let contentLicenseId: string | null = null;
    let contentManifest: string | null = null;
    let fileSize: number;
    try {
      const plainBuffer = await readFile(h5pDest);
      fileSize = plainBuffer.length;
      const { encrypted, encryptedKey: ek, fileKeyHex } = await encryptBuffer(plainBuffer);
      await writeFile(h5pDest, encrypted);
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
      fileSize = (await readFile(h5pDest)).length;
    }

    const relPath = `courses/${hash}/${h5pFilename}`;

    await prisma.course.update({
      where: { id },
      data: {
        filePath: relPath,
        originalFileName: file.originalName,
        fileSize: BigInt(fileSize),
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
    return NextResponse.json({ ok: true, slides: (meta as { slideCount: number }).slideCount });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (pptxPath) rm(pptxPath, { force: true }).catch(() => {});
    if (contentDir) rm(contentDir, { recursive: true, force: true }).catch(() => {});
  }
}
