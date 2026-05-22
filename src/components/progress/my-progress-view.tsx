"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Circle, AlertTriangle, CalendarClock, Play } from "lucide-react";
import Link from "next/link";
import { getDeadlineState } from "@/components/admin/progress-client";
import type { CourseStatus, AssignmentRow } from "@/components/admin/progress-client";
import { useTranslations, useLocale } from "next-intl";

function StatusBadge({ status }: { status: CourseStatus }) {
  const t = useTranslations("courses");
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> {t("completed")}
    </span>
  );
  if (status === "in_progress") return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2 py-0.5">
      <Clock className="w-3 h-3" /> {t("inProgress")}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2 py-0.5">
      <Circle className="w-3 h-3" /> {t("notStarted")}
    </span>
  );
}

export function MyProgressView({ assignments }: { assignments: AssignmentRow[] }) {
  const tc = useTranslations("courses");
  const tp = useTranslations("progress");
  const locale = useLocale();

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });

  const groups: { key: CourseStatus; label: string; color: string }[] = [
    { key: "in_progress", label: tc("inProgress"),  color: "bg-amber-400" },
    { key: "not_started", label: tc("notStarted"),  color: "bg-[#0071E3]" },
    { key: "completed",   label: tc("completed"),   color: "bg-emerald-400" },
  ];

  if (assignments.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-12 flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">{tp("noAssignments")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ key, label, color }) => {
        const group = assignments.filter((a) => a.status === key);
        if (group.length === 0) return null;
        return (
          <div key={key}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
              <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{label}</h3>
              <span className="text-[12px] text-[#ADADB8] font-medium">{group.length}</span>
            </div>
            <div className="space-y-2">
              {group.map((a) => {
                const dl = getDeadlineState(a.dueDate, a.assignedAt);
                return (
                  <div key={a.courseId}
                    className={cn(
                      "bg-white dark:bg-[#1C1C1E] rounded-2xl border px-5 py-4 flex items-center gap-4",
                      dl === "overdue" ? "border-red-200 dark:border-red-500/30" :
                      dl === "danger"  ? "border-orange-200 dark:border-orange-500/30" :
                      "border-[#E5E5EA] dark:border-[#3A3A3C]"
                    )}>
                    {/* Barre de progression verticale */}
                    <div className="w-1 h-10 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] overflow-hidden shrink-0">
                      <div
                        className={cn("w-full rounded-full transition-all",
                          a.status === "completed" ? "bg-emerald-400" :
                          a.status === "in_progress" ? "bg-amber-400" : "bg-[#D2D2D7]"
                        )}
                        style={{ height: `${a.progress}%`, marginTop: `${100 - a.progress}%` }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{a.courseTitle}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <StatusBadge status={a.status} />
                        {a.status !== "completed" && a.dueDate && (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[12px]",
                            dl === "overdue" ? "text-red-600" :
                            dl === "danger"  ? "text-orange-600" :
                            dl === "warning" ? "text-amber-600" :
                            "text-[#6E6E73] dark:text-[#8E8E93]"
                          )}>
                            {dl === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
                            {fmtDate(a.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barre de progression horizontale */}
                    <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                      <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            a.status === "completed" ? "bg-emerald-400" :
                            a.status === "in_progress" ? "bg-amber-400" : "bg-[#D2D2D7]"
                          )}
                          style={{ width: `${a.progress}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] w-8 text-right">{a.progress}%</span>
                    </div>

                    <Link
                      href={`/dashboard/courses/${a.courseId}/play`}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      {a.status === "completed" ? tc("review") : a.status === "in_progress" ? tc("resume") : tp("start")}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
