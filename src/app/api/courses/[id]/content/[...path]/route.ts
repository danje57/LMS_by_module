import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractH5P } from "@/lib/h5p";
import { readFile } from "fs/promises";
import path from "path";
import { lookup } from "mime-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, path: segments } = await params;

  const course = await prisma.course.findUnique({ where: { id, isActive: true } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  // Extraire si pas encore fait
  const extractDir = await extractH5P(course.filePath);

  // Sécuriser le chemin
  const safeSegments = segments.map((s) => s.replace(/\.\./g, "").replace(/[/\\]/g, ""));
  const filePath = path.join(extractDir, ...safeSegments);

  // Vérifier que le fichier est bien dans le dossier extrait
  if (!filePath.startsWith(extractDir)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Candidates: requested path, then fallback stripping version from first segment
  // (h5p-standalone expects H5P.Lib-1.3/ but .h5p files store H5P.Lib/)
  const candidates: string[] = [filePath];
  const versionMatch = safeSegments[0]?.match(/^(.+)-\d+\.\d+$/);
  if (versionMatch) {
    candidates.push(path.join(extractDir, versionMatch[1], ...safeSegments.slice(1)));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(extractDir)) continue;
    try {
      const buffer = await readFile(candidate);
      const mimeType = lookup(candidate) || "application/octet-stream";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      // try next candidate
    }
  }

  return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
}
