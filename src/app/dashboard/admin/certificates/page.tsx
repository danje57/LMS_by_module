import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CertificateSearch } from "./certificate-search";
import { ExportPanel } from "./export-panel";
import { GeneratePanel } from "./generate-panel";
import { CertificatesListPanel } from "./certificates-list-panel";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

interface PageProps {
  searchParams: Promise<{ id?: string; tab?: string }>;
}

export default async function AdminCertificatesPage({ searchParams }: PageProps) {
  const session = await auth();
  const isAdmin   = session?.user.sessionMode === "admin";
  const isManager = !isAdmin && session?.user?.id != null;

  if (!isAdmin && !isManager) redirect("/dashboard");

  // Managers don't need verify/export/generate — land on list tab
  const { id, tab = isManager ? "list" : "verify" } = await searchParams;
  const query = id?.trim().toLowerCase() ?? "";

  let result: {
    found: boolean;
    courseTitle?: string;
    learnerName?: string;
    learnerEmail?: string;
    completedAt?: Date;
    hasQuiz?: boolean;
    issuedAt?: Date;
    isPdf?: boolean;
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
          isPdf: cert.isPdf,
        }
      : { found: false };
  }

  const t = await getTranslations("certificates");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "long", year: "numeric" }).format(d);

  const tabs = [
    { key: "list",     label: "Tous les certificats", show: true },
    { key: "verify",   label: t("verify"),             show: isAdmin },
    { key: "export",   label: t("export"),             show: isAdmin },
    { key: "generate", label: t("generate"),           show: isAdmin },
  ].filter((t) => t.show);

  return (
    <div className={`mx-auto space-y-8 ${tab === "list" ? "max-w-5xl" : tab === "generate" ? "max-w-4xl" : "max-w-3xl"}`}>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{t("title")}</h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl w-fit">
        {tabs.map(tabItem => (
          <Link
            key={tabItem.key}
            href={`/dashboard/admin/certificates?tab=${tabItem.key}`}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === tabItem.key
                ? "bg-white dark:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
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
            <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">
              {t("verifyDesc")}
            </p>
          </div>

          <CertificateSearch defaultValue={query} />

          {query && result && (
            result.found ? (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-[14px] font-semibold text-emerald-700">{t("validCertificate")}</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <Row label={t("certificateNumber")} value={query.toUpperCase()} mono />
                  <Row label={t("learner")} value={result.learnerName ? `${result.learnerName} (${result.learnerEmail})` : result.learnerEmail!} />
                  <Row label="Type" value={result.isPdf ? "Document GRC" : "Formation"} />
                  <Row label={result.isPdf ? "Document" : t("course")} value={result.courseTitle!} />
                  <Row label={t("completedOn")} value={fmt(result.completedAt!)} />
                  <Row label={t("issuedOn")} value={fmt(result.issuedAt!)} />
                  {!result.isPdf && (
                    <Row
                      label={t("evaluation")}
                      value={result.hasQuiz ? t("withEvaluation") : t("noEvaluation")}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-6 py-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl">
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-[14px] font-semibold text-red-600">
                  {t("notFound")}
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* List tab */}
      {tab === "list" && <CertificatesListPanel />}

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
      <span className="w-48 shrink-0 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{label}</span>
      <span className={`text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] break-all ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
