import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PdfReaderClient } from "@/components/documents/pdf-reader-client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function DocumentReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: courseId } = await params;

  const doc = await prisma.course.findUnique({
    where: { id: courseId, courseType: "pdf", isActive: true },
    select: { id: true, title: true },
  });
  if (!doc) notFound();

  const isAdmin = session.user.sessionMode === "admin";

  // Vérifier l'assignation pour les non-admins
  if (!isAdmin) {
    const assignment = await prisma.courseAssignment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
    });
    if (!assignment) redirect("/dashboard/documents");
  }

  // Seuls les learners peuvent signer
  const isLearner = !isAdmin && !!(await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: "learner" } },
  }));

  const signature = isLearner
    ? await prisma.pdfSignature.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId } },
        select: { signedAt: true },
      })
    : null;

  const certificate = signature
    ? await prisma.certificate.findFirst({
        where: { userId: session.user.id, courseId },
        orderBy: { issuedAt: "desc" },
        select: { id: true },
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-4" style={{ height: "calc(100vh - 48px)" }}>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/documents"
          className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Documents
        </Link>
        <span className="text-[#D2D2D7]">/</span>
        <span className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] font-medium truncate">{doc.title}</span>
      </div>

      <PdfReaderClient
        courseId={courseId}
        title={doc.title}
        canSign={isLearner}
        alreadySigned={!!signature}
        signedAt={signature?.signedAt?.toISOString() ?? null}
        certificateId={certificate?.id ?? null}
      />
    </div>
  );
}
