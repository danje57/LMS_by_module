"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, Clock, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Cert = {
  id: string;
  courseTitle: string;
  completedAt: Date;
  hasQuiz: boolean;
  courseId: string | null;
};

type SortKey = "date" | "title";
type SortDir = "asc" | "desc";

function CertCard({ cert }: { cert: Cert }) {
  const dateStr = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(cert.completedAt));

  return (
    <Link
      href={`/dashboard/certificates/${cert.id}`}
      className="flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border border-[#E5E5EA] hover:border-[#D2D2D7] hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        <Award className="w-5 h-5 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{cert.courseTitle}</p>
          {cert.courseId === null && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F5F5F7] text-[#8E8E93] border border-[#E5E5EA]">
              Cours supprimé
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="w-3 h-3 text-[#ADADB8]" />
          <span className="text-[12px] text-[#6E6E73]">{dateStr}</span>
          {cert.hasQuiz && (
            <>
              <span className="text-[#D2D2D7]">·</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                Évaluation validée
              </span>
            </>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-600">
        Réussi
      </span>
    </Link>
  );
}

export function CertificateList({ certificates }: { certificates: Cert[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  const sorted = [...certificates].sort((a, b) => {
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
            : "bg-white border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F]"
        )}
      >
        <ArrowUpDown className="w-3 h-3" />
        {label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tri */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[#ADADB8] font-medium">Trier par</span>
        <SortButton k="date" label="Date" />
        <SortButton k="title" label="Nom" />
      </div>

      {sortKey === "date" ? (
        /* Groupé par année */
        (() => {
          const byYear = sorted.reduce<Record<number, Cert[]>>((acc, cert) => {
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
                    <span className="text-[13px] font-bold text-[#1D1D1F]">{year}</span>
                    <div className="flex-1 h-px bg-[#E5E5EA]" />
                    <span className="text-[11px] text-[#ADADB8]">{byYear[year].length} certificat{byYear[year].length !== 1 ? "s" : ""}</span>
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
        /* Liste plate (tri par nom) */
        <div className="space-y-3">
          {sorted.map((cert) => <CertCard key={cert.id} cert={cert} />)}
        </div>
      )}
    </div>
  );
}
