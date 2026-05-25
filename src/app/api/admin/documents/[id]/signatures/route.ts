import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocumentScope, assignmentWhereScope } from "@/lib/document-scope";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const scope = await getDocumentScope(session.user.id, session.user.sessionMode ?? null);
  if (!scope) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id: courseId } = await params;

  // Récupérer les utilisateurs assignés dans le scope de l'appelant
  const assignments = await prisma.courseAssignment.findMany({
    where: { courseId, ...assignmentWhereScope(scope) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const assignedUserIds = new Set(assignments.map((a) => a.user.id));

  // Signatures parmi ces utilisateurs
  const signatures = await prisma.pdfSignature.findMany({
    where: { courseId, userId: { in: [...assignedUserIds] } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { signedAt: "desc" },
  });

  const signedUserIds = new Set(signatures.map((s) => s.userId));

  const signed = signatures.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    email: s.user.email,
    signedAt: s.signedAt.toISOString(),
    ipAddress: s.ipAddress,
  }));

  const unsigned = assignments
    .filter((a) => !signedUserIds.has(a.user.id))
    .map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
    }));

  return NextResponse.json({ signed, unsigned });
}
