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
      createdBy: { select: { name: true, teams: { select: { team: { select: { name: true } } }, take: 1 } } },
      _count: {
        select: {
          assignments: scope.type === "admin"
            ? { where: {} }
            : { where: assignmentWhereScope(scope) },
        },
      },
    },
  });

  // Compter les signatures dans le scope (utilisateurs assignés par des authorized IDs)
  const docIds = docs.map((d) => d.id);
  const sigCounts = scope.type === "admin"
    ? await prisma.pdfSignature.groupBy({
        by: ["courseId"],
        where: { courseId: { in: docIds } },
        _count: true,
      })
    : await prisma.pdfSignature.groupBy({
        by: ["courseId"],
        where: {
          courseId: { in: docIds },
          user: {
            assignments: {
              some: {
                courseId: { in: docIds },
                ...assignmentWhereScope(scope),
              },
            },
          },
        },
        _count: true,
      });

  const sigMap = new Map(sigCounts.map((s) => [s.courseId, s._count]));

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
      signatureCount: sigMap.get(d.id) ?? 0,
      assignmentCount: d._count.assignments,
    }))
  );
}
