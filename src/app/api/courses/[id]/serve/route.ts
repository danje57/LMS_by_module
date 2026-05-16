import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id, isActive: true } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  const filePath = path.join(UPLOAD_DIR, course.filePath);

  try {
    const buffer = await readFile(filePath);

    // Renvoie une page HTML qui intègre le player H5P standalone
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${course.title}</title>
  <style>
    body { margin: 0; padding: 0; background: #1a1a1a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .player-wrap { width: 100%; max-width: 900px; }
    .info { color: #ccc; text-align: center; padding: 2rem; font-family: sans-serif; }
    .file-size { color: #888; font-size: 0.9em; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="player-wrap">
    <div class="info">
      <h2 style="color: white;">${course.title}</h2>
      <p>Fichier H5P chargé (${(Number(course.fileSize) / 1024 / 1024).toFixed(1)} Mo)</p>
      <p style="color: #f59e0b; margin-top: 1rem;">
        Le player H5P standalone sera intégré ici.<br>
        Pour l'activer, décompressez le .h5p et servez le contenu via h5p-standalone.
      </p>
    </div>
  </div>
  <script>
    // Ici sera intégré h5p-standalone une fois la librairie ajoutée
    console.log('H5P course ready:', '${course.id}');
  </script>
</body>
</html>`;

    // Vérifie juste que le fichier existe et est lisible
    if (buffer.length === 0) throw new Error("Fichier vide");

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de charger le cours" }, { status: 500 });
  }
}
