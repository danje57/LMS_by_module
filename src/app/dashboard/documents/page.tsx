import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentsPageClient } from "@/components/documents/documents-page-client";
import { getDocumentScope, docWhereScope, assignmentWhereScope } from "@/lib/document-scope";

export type MyDoc = {
  id: string;
  title: string;
  duration: number;
  fileSize: number;
  assignedAt: string;
  dueDate: string | null;
  signedAt: string | null;
  certificateId: string | null;
  status: "not_started" | "in_progress" | "signed";
  department: string | null;
  createdByName: string | null;
  assignedByName: string | null;
  teamName: string | null;
};

// ── Data fetching ────────────────────────────────────────────────────────────

async function getMyDocuments(userId: string) {
  const [assignments, viewedIds, signatures, certificates] = await Promise.all([
    prisma.courseAssignment.findMany({
      where: { userId, course: { courseType: "pdf", isActive: true } },
      include: {
        course: {
          select: {
            id: true, title: true, duration: true, fileSize: true, category: true,
            createdBy: { select: { name: true, teams: { select: { team: { select: { name: true } } }, take: 1 } } },
          },
        },
        assignedBy:    { select: { name: true } },
        assigningTeam: { select: { name: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId, action: "document.view" },
      distinct: ["targetId"],
      select: { targetId: true },
    }).then((r) => new Set(r.map((l) => l.targetId).filter(Boolean) as string[])),
    prisma.pdfSignature.findMany({
      where: { userId },
      select: { courseId: true, signedAt: true },
    }).then((r) => new Map(r.map((s) => [s.courseId, s.signedAt]))),
    prisma.certificate.findMany({
      where: { userId },
      select: { id: true, courseId: true },
      orderBy: { issuedAt: "desc" },
    }).then((r) => {
      const m = new Map<string, string>();
      for (const c of r) { if (c.courseId && !m.has(c.courseId)) m.set(c.courseId, c.id); }
      return m;
    }),
  ]);

  return assignments.map((a) => {
    const signedAt = signatures.get(a.course.id)?.toISOString() ?? null;
    const status: "not_started" | "in_progress" | "signed" =
      signedAt ? "signed" :
      viewedIds.has(a.course.id) ? "in_progress" :
      "not_started";

    return {
      id: a.course.id,
      title: a.course.title,
      duration: a.course.duration,
      fileSize: Number(a.course.fileSize),
      assignedAt: a.assignedAt.toISOString(),
      dueDate: a.dueDate?.toISOString() ?? null,
      signedAt,
      certificateId: certificates.get(a.course.id) ?? null,
      status,
      department:     a.course.category ?? a.course.createdBy?.teams[0]?.team.name ?? null,
      createdByName:  a.course.createdBy?.name                ?? null,
      assignedByName: a.assignedBy?.name          ?? null,
      teamName:       a.assigningTeam?.name       ?? null,
    };
  });
}

async function getLibraryDocuments(scope: Awaited<ReturnType<typeof getDocumentScope>>) {
  if (!scope) return [];

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
              some: { courseId: { in: docIds }, ...assignmentWhereScope(scope) },
            },
          },
        },
        _count: true,
      });

  const sigMap = new Map(sigCounts.map((s) => [s.courseId, s._count]));

  return docs.map((d) => ({
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
  }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const scope = await getDocumentScope(session.user.id, session.user.sessionMode ?? null);

  const [myDocs, libraryDocs] = await Promise.all([
    getMyDocuments(session.user.id),
    scope ? getLibraryDocuments(scope) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DocumentsPageClient
        myDocs={myDocs}
        libraryDocs={libraryDocs}
        canUpload={scope?.type === "admin" || scope?.type === "manager" || scope?.type === "creator"}
        hasLibrary={!!scope}
        isAdmin={scope?.type === "admin"}
        currentUserId={session.user.id}
      />
    </div>
  );
}
