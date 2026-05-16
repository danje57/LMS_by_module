import AdmZip from "adm-zip";
import path from "path";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Extrait un fichier .h5p dans un dossier "extracted" à côté du .h5p
export async function extractH5P(relativeH5PPath: string): Promise<string> {
  const h5pAbsPath = path.join(UPLOAD_DIR, relativeH5PPath);
  const extractDir = path.join(path.dirname(h5pAbsPath), "extracted");

  if (existsSync(extractDir)) return extractDir;

  await mkdir(extractDir, { recursive: true });
  const zip = new AdmZip(h5pAbsPath);
  zip.extractAllTo(extractDir, true);

  return extractDir;
}

// Retourne le chemin absolu vers un fichier dans le dossier extrait
export function getH5PContentPath(relativeH5PPath: string): string {
  const h5pAbsPath = path.join(UPLOAD_DIR, relativeH5PPath);
  return path.join(path.dirname(h5pAbsPath), "extracted");
}
