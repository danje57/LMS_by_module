import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { prisma } from "./prisma";

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const DATABASE_URL = process.env.DATABASE_URL!;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: u.username,
    password: decodeURIComponent(u.password),
    dbname: u.pathname.slice(1),
  };
}

function buildTimestamp(d: Date) {
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
}

export async function createBackup(opts?: { notes?: string; createdBy?: string }): Promise<{ id: string; filename: string; filePath: string; sizeBytes: number }> {
  ensureDir(BACKUP_DIR);
  const now = new Date();
  const ts = buildTimestamp(now);
  const backupName = `lms-backup-${ts}`;
  const tmpDir = path.join(BACKUP_DIR, `tmp-${ts}`);
  const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`);

  try {
    ensureDir(tmpDir);

    const db = parseDbUrl(DATABASE_URL);
    const env = { ...process.env, PGPASSWORD: db.password };

    // pg_dump — plain SQL avec DROP/CREATE pour restore propre
    const sqlPath = path.join(tmpDir, "db.sql");
    execSync(
      `/usr/bin/pg_dump --clean --if-exists -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.dbname} -f "${sqlPath}"`,
      { env, stdio: "pipe", timeout: 120_000 }
    );

    // manifest
    const manifest = {
      version: "1",
      createdAt: now.toISOString(),
      appVersion: "0.1",
      dbName: db.dbname,
    };
    fs.writeFileSync(path.join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // zip : manifest + db.sql + uploads/
    const zip = new AdmZip();
    zip.addLocalFile(path.join(tmpDir, "manifest.json"), "");
    zip.addLocalFile(sqlPath, "");
    if (fs.existsSync(UPLOAD_DIR)) {
      zip.addLocalFolder(UPLOAD_DIR, "uploads");
    }
    zip.writeZip(zipPath);

    const sizeBytes = fs.statSync(zipPath).size;

    const record = await prisma.backupRecord.create({
      data: {
        filename: `${backupName}.zip`,
        filePath: zipPath,
        sizeBytes,
        createdBy: opts?.createdBy ?? null,
        notes: opts?.notes ?? null,
      },
    });

    return { id: record.id, filename: record.filename, filePath: zipPath, sizeBytes };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function restoreBackup(zipPath: string): Promise<void> {
  const ts = buildTimestamp(new Date());
  const tmpDir = path.join(BACKUP_DIR, `restore-tmp-${ts}`);

  try {
    ensureDir(tmpDir);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);

    // Valider le manifest
    const manifestPath = path.join(tmpDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("Backup invalide : manifest.json absent");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.version || !manifest.createdAt) throw new Error("Manifest invalide ou corrompu");

    // Restaurer la base
    const sqlPath = path.join(tmpDir, "db.sql");
    if (!fs.existsSync(sqlPath)) throw new Error("Backup invalide : db.sql absent");
    const db = parseDbUrl(DATABASE_URL);
    const env = { ...process.env, PGPASSWORD: db.password };
    execSync(
      `/usr/bin/psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.dbname} -f "${sqlPath}"`,
      { env, stdio: "pipe", timeout: 300_000 }
    );

    // Restaurer les fichiers uploads
    const backupUploads = path.join(tmpDir, "uploads");
    if (fs.existsSync(backupUploads)) {
      fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
      ensureDir(UPLOAD_DIR);
      copyDirRecursive(backupUploads, UPLOAD_DIR);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function copyDirRecursive(src: string, dest: string) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

export async function deleteBackupRecord(id: string): Promise<void> {
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) return;
  if (fs.existsSync(record.filePath)) fs.rmSync(record.filePath, { force: true });
  await prisma.backupRecord.delete({ where: { id } });
}

export async function pruneOldBackups(keepCount: number): Promise<number> {
  const all = await prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" } });
  const toDelete = all.slice(keepCount);
  for (const r of toDelete) await deleteBackupRecord(r.id);
  return toDelete.length;
}
