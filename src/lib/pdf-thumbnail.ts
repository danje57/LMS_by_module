import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir } from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR  = process.env.UPLOAD_DIR ?? "./uploads";
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "pdf-thumb.cjs");

export async function generateAndSavePdfThumbnail(
  courseId: string,
  pdfRelPath: string,
): Promise<string> {
  const pdfPath  = path.join(UPLOAD_DIR, pdfRelPath);
  const thumbDir = path.join(UPLOAD_DIR, "thumbnails");
  await mkdir(thumbDir, { recursive: true });
  const thumbName = `${courseId}.jpg`;
  const thumbPath = path.join(thumbDir, thumbName);

  await execFileAsync("node", [SCRIPT_PATH, pdfPath, thumbPath], { timeout: 30_000 });

  return path.join("thumbnails", thumbName);
}
