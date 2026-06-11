import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWriteStream, mkdirSync } from "fs";
import { rm, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import { execFile } from "child_process";
import { encryptBuffer, signManifest } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";
import { promisify } from "util";
import AdmZip from "adm-zip";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const H5P_LIBS_DIR = process.env.H5P_LIBS_DIR ?? "./h5p-libraries";
const SCRIPTS_DIR = process.env.SCRIPTS_DIR ?? "./scripts";
const MAX_PPTX_SIZE = 200 * 1024 * 1024; // 200 Mo

function parseMultipart(req: NextRequest): Promise<{
  fields: Record<string, string>;
  file: { path: string; originalName: string; size: number } | null;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAX_PPTX_SIZE } });
    const fields: Record<string, string> = {};
    let fileResult: { path: string; originalName: string; size: number } | null = null;
    let busboyDone = false, writeDone = false, hasFile = false;

    function tryResolve() {
      if (busboyDone && (writeDone || !hasFile)) resolve({ fields, file: fileResult });
    }

    bb.on("field", (name, value) => { fields[name] = value; });

    bb.on("file", (_, stream, info) => {
      hasFile = true;
      const { filename } = info;
      if (!filename.toLowerCase().endsWith(".pptx")) {
        stream.resume();
        return reject(new Error("Seuls les fichiers .pptx sont acceptés"));
      }

      const hash = createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 12);
      const tmpPptxDir = path.join(UPLOAD_DIR, "tmp");
      mkdirSync(tmpPptxDir, { recursive: true });
      const pptxPath = path.join(tmpPptxDir, `${hash}.pptx`);
      const ws = createWriteStream(pptxPath);
      let size = 0;

      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.pipe(ws);
      ws.on("finish", () => {
        fileResult = { path: pptxPath, originalName: filename, size };
        writeDone = true;
        tryResolve();
      });
      ws.on("error", reject);
    });

    bb.on("finish", () => { busboyDone = true; tryResolve(); });
    bb.on("error", reject);
    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });
}

async function addLibrariesToZip(zip: AdmZip) {
  const libsPath = path.resolve(H5P_LIBS_DIR);
  try {
    const entries = await readdir(libsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const libDir = path.join(libsPath, entry.name);
      zip.addLocalFolder(libDir, entry.name);
    }
  } catch {
    // Si le dossier n'existe pas, on continue sans librairies externes
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let pptxPath: string | null = null;
  let contentDir: string | null = null;

  try {
    const { fields, file } = await parseMultipart(req);
    if (!file) return NextResponse.json({ error: "Fichier PPTX manquant" }, { status: 400 });

    pptxPath = file.path;
    const title = fields.title?.trim() || path.basename(file.originalName, ".pptx");
    const duration = parseInt(fields.duration ?? "30", 10) || 30;
    const hasQuiz = fields.hasQuiz === "on";
    const passingScore = hasQuiz ? (parseInt(fields.passingScore ?? "70", 10) || 70) : null;
    const force = fields.force === "true";
    const createdById = isAdmin ? (fields.createdById?.trim() || null) : session.user.id;

    // Hash du PPTX source pour détection de doublons
    const pptxBuffer = await readFile(pptxPath);
    const fileHash = createHash("sha1").update(pptxBuffer).digest("hex");

    if (!force) {
      const existing = await prisma.course.findFirst({ where: { fileHash, isActive: true } });
      if (existing) {
        await rm(pptxPath, { force: true });
        pptxPath = null;
        return NextResponse.json({ duplicate: true, existingTitle: existing.title, existingId: existing.id });
      }
    }

    // Dossier temporaire pour la conversion
    const hash = fileHash.slice(0, 12);
    contentDir = path.join(UPLOAD_DIR, "tmp", `converted_${hash}`);
    mkdirSync(contentDir, { recursive: true });

    // Lancer le script Python
    const scriptPath = path.resolve(SCRIPTS_DIR, "pptx_to_h5p.py");
    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, pptxPath, contentDir, title], {
      timeout: 300_000,
    });

    let meta: { slideCount: number; width: number; height: number } | { error: string };
    try {
      meta = JSON.parse(stdout.trim());
    } catch {
      throw new Error(`Script invalide: ${stdout} / ${stderr}`);
    }

    if ("error" in meta) throw new Error(meta.error);

    // Créer le .h5p (ZIP) avec contenu + librairies
    const courseHash = hash;
    const courseDir = path.join(UPLOAD_DIR, "courses", courseHash);
    mkdirSync(courseDir, { recursive: true });

    const h5pFilename = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) + ".h5p";
    const h5pDest = path.join(courseDir, h5pFilename);

    const zip = new AdmZip();

    // Ajouter le contenu généré (h5p.json + content/)
    zip.addLocalFile(path.join(contentDir, "h5p.json"), "");
    zip.addLocalFolder(path.join(contentDir, "content"), "content");

    // Ajouter les librairies H5P bundlées
    await addLibrariesToZip(zip);

    zip.writeZip(h5pDest);

    const fileSize = (await readFile(h5pDest)).length;
    const relPath = `courses/${courseHash}/${h5pFilename}`;

    // Copier le thumbnail généré par le script Python
    let thumbnailPath: string | null = null;
    try {
      const { copyFile } = await import("fs/promises");
      await copyFile(path.join(contentDir, "thumbnail.jpg"), path.join(courseDir, "thumbnail.jpg"));
      thumbnailPath = `courses/${courseHash}/thumbnail.jpg`;
    } catch { /* pas de thumbnail */ }

    // Chiffrement du contenu (licencing)
    let encryptedKey: string | null = null;
    let licenseEncryptedKey: string | null = null;
    let contentLicenseId: string | null = null;
    let contentManifest: string | null = null;
    try {
      const plainBuffer = await readFile(h5pDest);
      const { encrypted, encryptedKey: ek, fileKeyHex } = await encryptBuffer(plainBuffer);
      await writeFile(h5pDest, encrypted);
      encryptedKey = ek;
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      if (envelope) { licenseEncryptedKey = envelope.licenseEncryptedKey; contentLicenseId = envelope.contentLicenseId; }
    } catch { /* non critique — le cours reste en clair si le chiffrement échoue */ }

    // Créer l'enregistrement en base
    const course = await prisma.course.create({
      data: {
        title,
        filePath: relPath,
        originalFileName: file.originalName,
        fileSize: BigInt(fileSize),
        fileHash,
        duration,
        hasQuiz,
        passingScore,
        isActive: true,
        createdById,
        isEncrypted: !!encryptedKey,
        encryptedKey,
        licenseEncryptedKey,
        contentLicenseId,
        ...(thumbnailPath ? { thumbnailPath } : {}),
      },
    });

    // Manifest signé (non-répudiation)
    if (encryptedKey) {
      try {
        const manifest = await signManifest({
          courseId: course.id,
          contentHash: fileHash,
          createdBy: createdById ?? "unknown",
          createdAt: new Date().toISOString(),
          instanceId: "",
        });
        contentManifest = manifest;
        await prisma.course.update({ where: { id: course.id }, data: { contentManifest } });
      } catch { /* non critique */ }
    }

    return NextResponse.json({ success: true, courseId: course.id, slides: (meta as { slideCount: number }).slideCount });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Nettoyage
    if (pptxPath) rm(pptxPath, { force: true }).catch(() => {});
    if (contentDir) rm(contentDir, { recursive: true, force: true }).catch(() => {});
  }
}
