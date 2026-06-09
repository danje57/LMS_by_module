import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Non autorisé", { status: 401 });

  const { id } = await params;

  const doc = await prisma.course.findUnique({
    where: { id, courseType: "pdf", isActive: true },
    select: { id: true, thumbnailPath: true, filePath: true },
  });
  if (!doc) return new NextResponse("Document introuvable", { status: 404 });

  // Vignette déjà générée → servir directement
  if (doc.thumbnailPath) {
    try {
      const buffer = await readFile(path.join(UPLOAD_DIR, doc.thumbnailPath));
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {}
  }

  // Génération lazy pour les docs uploadés avant cette feature
  try {
    const { generateAndSavePdfThumbnail } = await import("@/lib/pdf-thumbnail");
    const thumbPath = await generateAndSavePdfThumbnail(doc.id, doc.filePath);
    await prisma.course.update({ where: { id: doc.id }, data: { thumbnailPath: thumbPath } });
    const buffer = await readFile(path.join(UPLOAD_DIR, thumbPath));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Vignette indisponible", { status: 404 });
  }
}
