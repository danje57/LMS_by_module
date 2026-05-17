import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { CertificateView } from "@/components/courses/certificate-view";

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

  return (
    <CertificateView
      id={cert.id}
      courseTitle={cert.courseTitle}
      learnerName={cert.user.name ?? cert.user.email ?? "Apprenant"}
      completedAt={cert.completedAt}
      hasQuiz={cert.hasQuiz}
      logoPath={branding?.logoPath ? `/api/assets/${branding.logoPath}` : null}
    />
  );
}
