import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CertificateSearch } from "./certificate-search";
import { ExportPanel } from "./export-panel";
import { GeneratePanel } from "./generate-panel";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

interface PageProps {
  searchParams: Promise<{ id?: string; tab?: string }>;
}

export default async function AdminCertificatesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { id, tab = "verify" } = await searchParams;
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

  if (query && tab === "verify") {
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

  const t = await getTranslations("certificates");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "long", year: "numeric" }).format(d);

  const tabs = [
    { key: "verify", label: t("verify") },
    { key: "export", label: t("export") },
    { key: "generate", label: t("generate") },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">{t("title")}</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F5F5F7] rounded-xl w-fit">
        {tabs.map(tabItem => (
          <Link
            key={tabItem.key}
            href={`/dashboard/admin/certificates?tab=${tabItem.key}`}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === tabItem.key
                ? "bg-white text-[#1D1D1F] shadow-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            {tabItem.label}
          </Link>
        ))}
      </div>

      {/* Verify tab */}
      {tab === "verify" && (
        <div className="space-y-6">
          <div>
            <p className="text-[14px] text-[#6E6E73]">
              {t("verifyDesc")}
            </p>
          </div>

          <CertificateSearch defaultValue={query} />

          {query && result && (
            result.found ? (
              <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-emerald-50 border-b border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-[14px] font-semibold text-emerald-700">{t("validCertificate")}</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <Row label={t("certificateNumber")} value={query.toUpperCase()} mono />
                  <Row label={t("learner")} value={result.learnerName ? `${result.learnerName} (${result.learnerEmail})` : result.learnerEmail!} />
                  <Row label={t("course")} value={result.courseTitle!} />
                  <Row label={t("completedOn")} value={fmt(result.completedAt!)} />
                  <Row label={t("issuedOn")} value={fmt(result.issuedAt!)} />
                  <Row
                    label={t("evaluation")}
                    value={result.hasQuiz ? t("withEvaluation") : t("noEvaluation")}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-100 rounded-2xl">
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-[14px] font-semibold text-red-600">
                  {t("notFound")}
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Export tab */}
      {tab === "export" && <ExportPanel />}

      {/* Generate tab */}
      {tab === "generate" && <GeneratePanel />}
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
