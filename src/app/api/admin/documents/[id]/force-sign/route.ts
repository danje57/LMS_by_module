import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { getDocumentScope, assignmentWhereScope } from "@/lib/document-scope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const scope = await getDocumentScope(session.user.id, session.user.sessionMode ?? null);
  if (!scope) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;
  const { userId } = await req.json() as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  const doc = await prisma.course.findUnique({
    where: { id: courseId, courseType: "pdf", isActive: true },
    select: { id: true, title: true },
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  // Vérifier que cet utilisateur est bien dans le scope (assigné par l'appelant ou ses creators)
  if (scope.type !== "admin") {
    const assignment = await prisma.courseAssignment.findFirst({
      where: { courseId, userId, ...assignmentWhereScope(scope) },
    });
    if (!assignment)
      return NextResponse.json({ error: "Cet utilisateur n'est pas dans votre scope" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const existing = await prisma.pdfSignature.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadySigned: true });

  const now = new Date();

  await prisma.$transaction([
    prisma.pdfSignature.create({
      data: { userId, courseId, signedAt: now, ipAddress: null },
    }),
    prisma.certificate.create({
      data: { userId, courseId, courseTitle: doc.title, completedAt: now, hasQuiz: false, issuedAt: now },
    }),
  ]);

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "document.force-signed",
    targetId: courseId,
    targetLabel: doc.title,
    details: { forcedForUserId: userId, forcedForUserEmail: user.email },
  });

  return NextResponse.json({ ok: true, signedAt: now.toISOString() });
}
