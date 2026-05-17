import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CertificateSearch } from "./certificate-search";
import { CheckCircle2, XCircle } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function AdminCertificatesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { id } = await searchParams;
  const query = id?.trim().toLowerCase() ?? "";

  let result: {
    found: boolean;
    courseTitle?: string;
    learnerName?: string;
    learnerEmail?: string;
    completedAt?: Date;
    hasQuiz?: boolean;
    issuedAt?: Date;
  } | null = null;

  if (query) {
    const cert = await prisma.certificate.findUnique({
      where: { id: query },
      include: { user: { select: { name: true, email: true } } },
    });

    result = cert
      ? {
          found: true,
          courseTitle: cert.courseTitle,
          learnerName: cert.user.name ?? undefined,
          learnerEmail: cert.user.email,
          completedAt: cert.completedAt,
          hasQuiz: cert.hasQuiz,
          issuedAt: cert.issuedAt,
        }
      : { found: false };
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Vérification de certificat</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          Saisissez le numéro de certificat pour valider son authenticité.
        </p>
      </div>

      <CertificateSearch defaultValue={query} />

      {query && result && (
        result.found ? (
          <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
            {/* Status banner */}
            <div className="flex items-center gap-3 px-6 py-4 bg-emerald-50 border-b border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-[14px] font-semibold text-emerald-700">Certificat valide — émis par cette application</p>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              <Row label="Numéro de certificat" value={query.toUpperCase()} mono />
              <Row label="Apprenant" value={result.learnerName ? `${result.learnerName} (${result.learnerEmail})` : result.learnerEmail!} />
              <Row label="Cours" value={result.courseTitle!} />
              <Row label="Complété le" value={fmt(result.completedAt!)} />
              <Row label="Certificat émis le" value={fmt(result.issuedAt!)} />
              <Row
                label="Évaluation"
                value={result.hasQuiz ? "Sanctionné par une évaluation des connaissances" : "Aucune évaluation associée"}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-100 rounded-2xl">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-[14px] font-semibold text-red-600">
              Aucun certificat trouvé pour cet identifiant.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="w-48 shrink-0 text-[13px] text-[#6E6E73]">{label}</span>
      <span className={`text-[13px] font-medium text-[#1D1D1F] break-all ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
