import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, BookOpen } from "lucide-react";
import { CertificateList } from "@/components/certificates/certificate-list";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certificates = await prisma.certificate.findMany({
    where: { userId: session.user.id },
    orderBy: { completedAt: "desc" },
    select: { id: true, courseTitle: true, completedAt: true, hasQuiz: true },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Mes certificats</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {certificates.length} certificat{certificates.length !== 1 ? "s" : ""} obtenu{certificates.length !== 1 ? "s" : ""}
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Award className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">Aucun certificat pour l&apos;instant</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Terminez un cours pour obtenir votre premier certificat.</p>
          <Link href="/dashboard/courses" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[#0071E3] hover:underline">
            <BookOpen className="w-4 h-4" />
            Voir mes cours
          </Link>
        </div>
      ) : (
        <CertificateList certificates={certificates} />
      )}
    </div>
  );
}
