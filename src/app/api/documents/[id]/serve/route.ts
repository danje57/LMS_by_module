import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

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
    select: { id: true, title: true, filePath: true },
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
    auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "document.view",
      targetId: doc.id,
      targetLabel: doc.title,
    }).catch(() => {});
  }

  try {
    const filePath = path.join(UPLOAD_DIR, doc.filePath);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
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
