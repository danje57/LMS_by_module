import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Seuls les assets de branding sont publics
const ALLOWED_PREFIXES = ["branding/"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const safePath = segments.map((s) => s.replace(/\.\./g, "")).join("/");

  const isAllowed = ALLOWED_PREFIXES.some((prefix) => safePath.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const filePath = path.join(UPLOAD_DIR, safePath);

  try {
    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentTypes: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      svg: "image/svg+xml", webp: "image/webp",
    };
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypes[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
