import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id: courseId } = await params;

  const doc = await prisma.course.findUnique({
    where: { id: courseId, courseType: "pdf", isActive: true },
    select: { id: true, title: true },
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const isLearner = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: "learner" } },
  });
  if (!isLearner) return NextResponse.json({ error: "Seuls les apprenants peuvent signer" }, { status: 403 });

  const assignment = await prisma.courseAssignment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!assignment) return NextResponse.json({ error: "Non assigné" }, { status: 403 });

  const existing = await prisma.pdfSignature.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadySigned: true, signedAt: existing.signedAt.toISOString() });

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const now = new Date();

  const [signature, certificate] = await prisma.$transaction([
    prisma.pdfSignature.create({
      data: { userId: session.user.id, courseId, ipAddress, signedAt: now },
    }),
    prisma.certificate.create({
      data: {
        userId: session.user.id,
        courseId,
        courseTitle: doc.title,
        completedAt: now,
        hasQuiz: false,
        isPdf: true,
        issuedAt: now,
      },
    }),
  ]);

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "document.signed",
    targetId: courseId,
    targetLabel: doc.title,
    details: { signatureId: signature.id, ipAddress },
  });

  return NextResponse.json({ ok: true, signedAt: now.toISOString(), certificateId: certificate.id });
}
