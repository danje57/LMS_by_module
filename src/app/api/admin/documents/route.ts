import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocumentScope, docWhereScope, assignmentWhereScope } from "@/lib/document-scope";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const scope = await getDocumentScope(session.user.id, session.user.sessionMode ?? null);
  if (!scope) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const docs = await prisma.course.findMany({
    where: { courseType: "pdf", isActive: true, ...docWhereScope(scope) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      duration: true,
      fileSize: true,
      originalFileName: true,
      createdAt: true,
      category: true,
      createdById: true,
      createdBy: { select: { name: true, teams: { select: { team: { select: { name: true } } } } } },
      _count: {
        select: {
          assignments: scope.type === "admin"
            ? { where: {} }
            : { where: assignmentWhereScope(scope) },
        },
      },
    },
  });

  // Compter les signatures dans le scope
  const docIds = docs.map((d) => d.id);
  let sigMap: Map<string, number>;

  if (scope.type === "admin") {
    const sigCounts = await prisma.pdfSignature.groupBy({
      by: ["courseId"],
      where: { courseId: { in: docIds } },
      _count: true,
    });
    sigMap = new Map(sigCounts.map((s) => [s.courseId, s._count]));
  } else {
    // Pour manager/creator : on restreint aux paires (courseId, userId) exactement en scope
    // (la requête groupBy ne peut pas corréler courseId de la signature avec le courseId de l'assignment)
    const scopedAssignments = await prisma.courseAssignment.findMany({
      where: { courseId: { in: docIds }, ...assignmentWhereScope(scope) },
      select: { courseId: true, userId: true },
    });
    const scopedPairs = new Set(scopedAssignments.map((a) => `${a.courseId}:${a.userId}`));
    const sigs = await prisma.pdfSignature.findMany({
      where: { courseId: { in: docIds } },
      select: { courseId: true, userId: true },
    });
    sigMap = new Map();
    for (const s of sigs) {
      if (scopedPairs.has(`${s.courseId}:${s.userId}`)) {
        sigMap.set(s.courseId, (sigMap.get(s.courseId) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      duration: d.duration,
      fileSize: Number(d.fileSize),
      originalFileName: d.originalFileName,
      createdAt: d.createdAt.toISOString(),
      department: d.category ?? d.createdBy?.teams[0]?.team.name ?? null,
      createdByName: d.createdBy?.name ?? null,
      createdById: d.createdById ?? null,
      createdByTeams: d.createdBy?.teams.map((t) => t.team.name) ?? [],
      signatureCount: sigMap.get(d.id) ?? 0,
      assignmentCount: d._count.assignments,
    }))
  );
}
