import AdmZip from "adm-zip";
import path from "path";
import { existsSync } from "fs";
import { mkdir, rm } from "fs/promises";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Extrait un fichier .h5p dans un dossier "extracted" à côté du .h5p
export async function extractH5P(relativeH5PPath: string): Promise<string> {
  const h5pAbsPath = path.join(UPLOAD_DIR, relativeH5PPath);

  if (!existsSync(h5pAbsPath)) {
    throw new Error(`Fichier H5P introuvable : ${relativeH5PPath}. Veuillez re-uploader le cours.`);
  }

  const extractDir = path.join(path.dirname(h5pAbsPath), "extracted");

  // Ne skip l'extraction que si le dossier a bien du contenu (h5p.json présent)
  if (existsSync(path.join(extractDir, "h5p.json"))) return extractDir;

  // Dossier vide ou corrompu : on repart de zéro
  if (existsSync(extractDir)) {
    await rm(extractDir, { recursive: true, force: true });
  }

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
