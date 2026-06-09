"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, Clock, ArrowUpDown, BookOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

type Cert = {
  id: string;
  courseTitle: string;
  completedAt: Date;
  hasQuiz: boolean;
  courseId: string | null;
  isPdf: boolean;
};

type SortKey = "date" | "title";
type SortDir = "asc" | "desc";

function CertCard({ cert }: { cert: Cert }) {
  const t = useTranslations("certificates");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  const dateStr = new Intl.DateTimeFormat(dateLocale, {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(cert.completedAt));

  return (
    <Link
      href={`/dashboard/certificates/${cert.id}`}
      className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#D2D2D7] dark:hover:border-[#636366] hover:shadow-sm transition-all"
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        cert.isPdf
          ? "bg-indigo-50 dark:bg-indigo-500/10"
          : "bg-emerald-50 dark:bg-emerald-500/10",
      )}>
        {cert.isPdf
          ? <FileText className="w-5 h-5 text-indigo-500" />
          : <Award className="w-5 h-5 text-emerald-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{cert.courseTitle}</p>
          {cert.courseId === null && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#8E8E93] border border-[#E5E5EA] dark:border-[#3A3A3C]">
              {t("deletedCourse")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="w-3 h-3 text-[#ADADB8]" />
          <span className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{dateStr}</span>
          {cert.hasQuiz && (
            <>
              <span className="text-[#D2D2D7]">·</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                {t("assessmentPassed")}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={cn(
        "shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1",
        cert.isPdf
          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600"
          : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600",
      )}>
        {cert.isPdf ? "Signé" : t("passed")}
      </span>
    </Link>
  );
}

const PAGE_SIZE = 15;

function SortedList({ certs }: { certs: Cert[] }) {
  const t = useTranslations("certificates");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  const sorted = [...certs].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") {
      cmp = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    } else {
      cmp = a.courseTitle.localeCompare(b.courseTitle, "fr");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[12px] font-medium transition-all",
          active
            ? "bg-[#0071E3] border-[#0071E3] text-white"
            : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
        )}
      >
        <ArrowUpDown className="w-3 h-3" />
        {label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">Aucun certificat dans cette catégorie</p>
      </div>
    );
  }

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[#ADADB8] font-medium">{t("sortBy")}</span>
        <SortButton k="date" label={t("sortDate")} />
        <SortButton k="title" label={t("sortName")} />
      </div>

      {sortKey === "date" ? (
        (() => {
          const byYear = paged.reduce<Record<number, Cert[]>>((acc, cert) => {
            const y = new Date(cert.completedAt).getFullYear();
            (acc[y] ??= []).push(cert);
            return acc;
          }, {});
          const years = Object.keys(byYear).map(Number).sort((a, b) => sortDir === "desc" ? b - a : a - b);

          return (
            <div className="space-y-6">
              {years.map((year) => (
                <div key={year}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{year}</span>
                    <div className="flex-1 h-px bg-[#E5E5EA] dark:bg-[#3A3A3C]" />
                    <span className="text-[11px] text-[#ADADB8]">{t("obtained", { count: byYear[year].length })}</span>
                  </div>
                  <div className="space-y-3">
                    {byYear[year].map((cert) => <CertCard key={cert.id} cert={cert} />)}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      ) : (
        <div className="space-y-3">
          {paged.map((cert) => <CertCard key={cert.id} cert={cert} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
          <span className="text-[12px] text-[#ADADB8]">{sorted.length} certificat{sorted.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-[12px] border border-[#E5E5EA] dark:border-[#3A3A3C] disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "w-8 h-8 rounded-lg text-[12px] font-medium transition-colors",
                  p === page
                    ? "bg-[#0071E3] text-white"
                    : "hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]",
                )}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-[12px] border border-[#E5E5EA] dark:border-[#3A3A3C] disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "courses" | "grc";

export function CertificateList({
  courseCerts,
  grcCerts,
}: {
  courseCerts: Cert[];
  grcCerts: Cert[];
}) {
  const [tab, setTab] = useState<Tab>(courseCerts.length > 0 ? "courses" : "grc");

  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "courses", label: "Formations", icon: BookOpen,  count: courseCerts.length },
    { key: "grc",     label: "Documents GRC", icon: FileText, count: grcCerts.length },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-2xl w-fit">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all",
              tab === key
                ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className={cn(
              "text-[11px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
              tab === key
                ? "bg-[#0071E3]/10 text-[#0071E3]"
                : "bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#8E8E93]",
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "courses" && <SortedList certs={courseCerts} />}
      {tab === "grc"     && <SortedList certs={grcCerts} />}
    </div>
  );
}
