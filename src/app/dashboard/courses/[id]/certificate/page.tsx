import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CertificateRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cert = await prisma.certificate.findFirst({
    where: { userId: session.user.id, courseId },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  redirect(cert ? `/dashboard/certificates/${cert.id}` : "/dashboard/certificates");
}
