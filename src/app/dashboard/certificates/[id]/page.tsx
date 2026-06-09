import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { CertificateView } from "@/components/courses/certificate-view";
import { auditLog } from "@/lib/audit";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [cert, branding] = await Promise.all([
    prisma.certificate.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.brandingSetting.findFirst({ select: { logoPath: true } }),
  ]);

  // Only the owner can view their certificate
  if (!cert || cert.userId !== session.user.id) notFound();

  const course = cert.courseId
    ? await prisma.course.findUnique({
        where: { id: cert.courseId },
        select: { courseType: true },
      })
    : null;

  void auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "certificate.download", targetId: cert.id, targetLabel: cert.courseTitle });

  // Use session name as primary — cert.userId === session.user.id is enforced above
  const learnerName = session.user.name ?? cert.user.name ?? cert.user.email ?? "Apprenant";

  return (
    <CertificateView
      id={cert.id}
      courseTitle={cert.courseTitle}
      learnerName={learnerName}
      completedAt={cert.completedAt}
      hasQuiz={cert.hasQuiz}
      isPdf={course?.courseType === "pdf"}
      logoPath={branding?.logoPath ? `/api/assets/${branding.logoPath}` : null}
    />
  );
}
