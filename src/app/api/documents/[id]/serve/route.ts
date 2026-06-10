import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { readFile } from "fs/promises";
import path from "path";
import { decryptBuffer } from "@/lib/instance-crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

// Cache mémoire pour éviter les doublons document.view (requêtes Range parallèles de PDF.js)
const viewCache = new Map<string, number>(); // clé: "userId:docId", valeur: timestamp
const VIEW_TTL = 60 * 60 * 1000; // 1 heure

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Non autorisé", { status: 401 });

  const { id } = await params;

  const doc = await prisma.course.findUnique({
    where: { id, courseType: "pdf", isActive: true },
    select: { id: true, title: true, filePath: true, isEncrypted: true, encryptedKey: true },
  });
  if (!doc) return new NextResponse("Document introuvable", { status: 404 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const assignment = await prisma.courseAssignment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: id } },
    });
    if (!assignment) return new NextResponse("Non autorisé", { status: 403 });
  }

  if (!isAdmin) {
    const cacheKey = `${session.user.id}:${doc.id}`;
    const lastView = viewCache.get(cacheKey) ?? 0;
    if (Date.now() - lastView > VIEW_TTL) {
      viewCache.set(cacheKey, Date.now());
      auditLog({
        actor: { id: session.user.id, name: session.user.name, email: session.user.email },
        action: "document.view",
        targetId: doc.id,
        targetLabel: doc.title,
      });
    }
  }

  try {
    const filePath = path.join(UPLOAD_DIR, doc.filePath);
    const rawBuffer = await readFile(filePath);
    const pdfBuffer: Buffer = (doc.isEncrypted && doc.encryptedKey)
      ? await decryptBuffer(rawBuffer, doc.encryptedKey)
      : rawBuffer;
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }
}
