"use client";

import { useState } from "react";
import type { Course } from "@prisma/client";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { Search, Clock, CircleCheck, Play, Pencil, ArrowUpDown, UserPlus, Award, CalendarClock, AlertTriangle, Tag, Video, Presentation, Layers } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { DeleteCourseButton } from "@/components/courses/delete-course-button";
import { AssignModal } from "@/components/admin/assign-modal";
import { AssignModalManager } from "@/components/courses/assign-modal-manager";

export type CourseProgress = {
  status: "not_started" | "in_progress" | "completed";
  completedAt: Date | null;
  quizPassed: boolean | null;
  latestCertificateId: string | null;
};

export type CourseMeta = {
  createdByName: string | null;
  assignedByName: string | null;
  dueDate: string | null;
  assignedAt: string | null;
};

type DeadlineState = "overdue" | "danger" | "warning" | "normal" | null;

function getDeadlineState(dueDate: string | null, assignedAt: string | null): DeadlineState {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const remainingDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (remainingDays < 0) return "overdue";
  const assigned = assignedAt ? new Date(assignedAt) : null;
  const totalDays = assigned ? Math.round((due.getTime() - assigned.getTime()) / 86400000) : 0;
  const threshold = Math.max(totalDays * 0.15, 3);
  if (remainingDays <= 3)         return "danger";
  if (remainingDays <= threshold) return "warning";
  return "normal";
}

interface CourseListProps {
  courses: Course[];
  isAdmin?: boolean;
  isManagerOrCreator?: boolean;
  progressMap?: Record<string, CourseProgress>;
  metaMap?: Record<string, CourseMeta>;
  assignedCourseIds?: string[];
  assignableCourseIds?: Set<string>;
}

function getTypeBadge(course: Course) {
  if (course.courseType === "native_video") {
    return { Icon: Video, label: "Vidéo", cls: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" };
  }
  const fname = (course.originalFileName ?? "").toLowerCase();
  if (course.courseType === "h5p" && fname.endsWith(".pptx")) {
    return { Icon: Presentation, label: "PowerPoint", cls: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" };
  }
  if (course.courseType === "h5p") {
    return { Icon: Layers, label: "H5P", cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" };
  }
  return null;
}

function CourseCard({
  course,
  isAdmin,
  isManagerOrCreator,
  progressMap,
  meta,
  isAssignedToMe,
  hideDeadline = false,
  isDeletable = false,
  showTypeBadge = false,
  onAssign,
  onManagerAssign,
}: {
  course: Course;
  isAdmin: boolean;
  isManagerOrCreator: boolean;
  progressMap: Record<string, CourseProgress>;
  meta?: CourseMeta;
  isAssignedToMe: boolean;
  hideDeadline?: boolean;
  isDeletable?: boolean;
  showTypeBadge?: boolean;
  onAssign: (t: { id: string; title: string }) => void;
  onManagerAssign: (t: { id: string; title: string }) => void;
}) {
  const t = useTranslations("courses");
  const locale = useLocale();
  const prog = progressMap[course.id];
  const status = prog?.status ?? "not_started";
  const isCompleted = status === "completed";
  const deadlineState = !isCompleted && isAssignedToMe && !hideDeadline ? getDeadlineState(meta?.dueDate ?? null, meta?.assignedAt ?? null) : null;

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });

  return (
    <div className={cn(
      "group bg-white dark:bg-[#1C1C1E] rounded-2xl border overflow-hidden hover:shadow-md transition-all",
      !hideDeadline && deadlineState === "overdue" ? "border-red-300 hover:border-red-400" :
      !hideDeadline && deadlineState === "danger"  ? "border-orange-300 hover:border-orange-400" :
      "border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#D2D2D7] dark:hover:border-[#636366]"
    )}>
      {course.thumbnailPath ? (
        <div className="h-36 overflow-hidden bg-[#F5F5F7] dark:bg-[#2C2C2E]">
          <img
            src={`/api/courses/${course.id}/thumbnail?v=${new Date(course.updatedAt).getTime()}`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className={cn(
          "h-1.5 bg-gradient-to-r",
          hideDeadline                              ? "from-[#0071E3] to-[#40B3FF]" :
          deadlineState === "overdue"               ? "from-red-500 to-red-400" :
          deadlineState === "danger"                ? "from-orange-400 to-amber-400" :
          deadlineState === "warning"               ? "from-amber-400 to-yellow-300" :
          isCompleted                               ? "from-emerald-400 to-teal-400" :
          status === "in_progress"                  ? "from-amber-400 to-orange-400" :
                                                      "from-[#0071E3] to-[#40B3FF]"
        )} />
      )}

      <div className="p-5 space-y-4">
        <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug line-clamp-2">
          {course.title}
        </h3>

        {course.category && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10 rounded-lg px-2 py-0.5 w-fit">
            <Tag className="w-3 h-3" />
            {course.category}
          </span>
        )}

        {deadlineState && meta?.dueDate && (
          <div className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1 w-fit",
            deadlineState === "overdue" ? "text-red-600 bg-red-50 dark:bg-red-500/10" :
            deadlineState === "danger"  ? "text-orange-600 bg-orange-50 dark:bg-orange-500/10" :
            deadlineState === "warning" ? "text-amber-600 bg-amber-50 dark:bg-amber-500/10" :
            "text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E]"
          )}>
            {deadlineState === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
            {deadlineState === "overdue"
              ? t("overdue", { date: fmtDate(meta.dueDate) })
              : t("deadline", { date: fmtDate(meta.dueDate) })
            }
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {showTypeBadge && (() => {
            const badge = getTypeBadge(course);
            if (!badge) return null;
            const { Icon, label, cls } = badge;
            return (
              <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1 ${cls}`}>
                <Icon className="w-3 h-3" />
                {label}
              </span>
            );
          })()}
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1">
            <Clock className="w-3 h-3" />
            {formatDuration(course.duration)}
          </span>
          {course.hasQuiz && (
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1",
              !isAdmin && isCompleted && prog?.quizPassed === true ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" :
              !isAdmin && isCompleted && prog?.quizPassed === false ? "text-red-500 bg-red-50 dark:bg-red-500/10" :
              "text-amber-600 bg-amber-50 dark:bg-amber-500/10"
            )}>
              <CircleCheck className="w-3 h-3" />
              {!isAdmin && isCompleted && prog?.quizPassed !== null
                ? (prog?.quizPassed ? t("quizPassed") : t("quizFailed"))
                : t("quizScore", { score: course.passingScore ?? 0 })}
            </span>
          )}
        </div>

        {(meta?.createdByName || (isAssignedToMe && meta?.assignedByName)) && (
          <p className="text-[11px] text-[#ADADB8] leading-relaxed">
            {meta?.createdByName && <span>{t("createdBy")} <span className="text-[#6E6E73] dark:text-[#8E8E93]">{meta.createdByName}</span></span>}
            {meta?.createdByName && isAssignedToMe && meta?.assignedByName && <span> · </span>}
            {isAssignedToMe && meta?.assignedByName && <span>{t("assignedBy")} <span className="text-[#6E6E73] dark:text-[#8E8E93]">{meta.assignedByName}</span></span>}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#ADADB8]">{formatFileSize(course.fileSize)}</span>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <>
                <button
                  onClick={() => onAssign({ id: course.id, title: course.title })}
                  className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
                  title={t("assign")}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/dashboard/admin/courses/${course.id}/edit`}
                  className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
                  title={t("edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
              </>
            )}
            {isManagerOrCreator && isDeletable && (
              <>
                <Link
                  href={`/dashboard/admin/courses/${course.id}/edit`}
                  className="p-2 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors"
                  title={t("edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                <DeleteCourseButton courseId={course.id} courseTitle={course.title} isManagerContext />
              </>
            )}
            {isManagerOrCreator && (
              <button
                onClick={() => onManagerAssign({ id: course.id, title: course.title })}
                className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                title={t("affect")}
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {!isAdmin && !hideDeadline && isAssignedToMe && isCompleted && prog?.latestCertificateId && (
              <Link
                href={`/dashboard/certificates/${prog.latestCertificateId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-[13px] font-medium rounded-xl transition-colors"
                title={t("certificate")}
              >
                <Award className="w-3.5 h-3.5" />
                {t("certificate")}
              </Link>
            )}
            {(isAdmin || (isManagerOrCreator && hideDeadline)) && (
              <Link
                href={`/dashboard/courses/${course.id}/play`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[13px] font-medium rounded-xl transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {t("preview")}
              </Link>
            )}
            {!isAdmin && !hideDeadline && isAssignedToMe && (
              <Link
                href={`/dashboard/courses/${course.id}/play`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {status === "in_progress" ? t("resume") : status === "completed" ? t("review") : t("launch")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZES = [0, 5, 10, 20, 50] as const;

export function CourseList({ courses, isAdmin = false, isManagerOrCreator = false, progressMap = {}, metaMap = {}, assignedCourseIds, assignableCourseIds }: CourseListProps) {
  const t = useTranslations("courses");
  const assignedSet = new Set(assignedCourseIds ?? []);
  const [search, setSearch] = useState("");
  const [filterQuiz, setFilterQuiz] = useState<"all" | "yes" | "no">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "not_started" | "in_progress" | "completed">("all");
  const [durationSort, setDurationSort] = useState<"none" | "asc" | "desc">("none");
  const [assignTarget, setAssignTarget] = useState<{ id: string; title: string } | null>(null);
  const [managerAssignTarget, setManagerAssignTarget] = useState<{ id: string; title: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"mes-formations" | "bibliotheque">("mes-formations");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);

  function resetPage() { setPage(1); }

  const allCategories = [...new Set(courses.map((c) => c.category).filter(Boolean) as string[])].sort();

  const filtered = courses
    .filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      const matchQuiz = filterQuiz === "all" || (filterQuiz === "yes" ? c.hasQuiz : !c.hasQuiz);
      const matchCategory = filterCategory === "all" || c.category === filterCategory;
      return matchSearch && matchQuiz && matchCategory;
    })
    .sort((a, b) => {
      if (durationSort === "asc") return a.duration - b.duration;
      if (durationSort === "desc") return b.duration - a.duration;
      return 0;
    });

  const myFormations = filtered.filter((c) => assignedSet.has(c.id));
  const libraryFiltered = assignableCourseIds
    ? filtered.filter((c) => assignableCourseIds.has(c.id))
    : filtered;

  const activeList = isAdmin
    ? filtered
    : isManagerOrCreator
      ? (activeTab === "mes-formations" ? myFormations : libraryFiltered)
      : filtered;

  const totalItems = activeList.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const paginated = pageSize === 0 ? activeList : activeList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder={t("searchCourse")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <div className="flex gap-1.5 bg-white dark:bg-[#2C2C2E] border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl p-1">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setFilterQuiz(v); resetPage(); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterQuiz === v ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              )}
            >
              {v === "all" ? t("all") : v === "yes" ? t("withQuiz") : t("withoutQuiz")}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setDurationSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none")); resetPage(); }}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-[13px] font-medium transition-all whitespace-nowrap",
            durationSort !== "none"
              ? "bg-[#0071E3] border-[#0071E3] text-white shadow-sm"
              : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          )}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {t("duration")}
          {durationSort === "asc" && <span className="text-[11px]">↑</span>}
          {durationSort === "desc" && <span className="text-[11px]">↓</span>}
        </button>

        {allCategories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); resetPage(); }}
            className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all cursor-pointer"
          >
            <option value="all">Tous les départements</option>
            {allCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all cursor-pointer"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? "Tous" : `${s} / page`}
            </option>
          ))}
        </select>
      </div>

      {!isAdmin && (!isManagerOrCreator || (assignedSet.size > 0 && activeTab === "mes-formations")) && (
        <div className="flex gap-1.5 bg-white dark:bg-[#2C2C2E] border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl p-1 w-fit">
          {([
            { key: "all" as const,         labelKey: "all" as const,        dot: null },
            { key: "not_started" as const, labelKey: "notStarted" as const, dot: "bg-[#0071E3]" },
            { key: "in_progress" as const, labelKey: "inProgress" as const, dot: "bg-amber-400" },
            { key: "completed" as const,   labelKey: "completed" as const,  dot: "bg-emerald-400" },
          ]).map(({ key, labelKey, dot }) => (
            <button
              key={key}
              onClick={() => { setFilterStatus(key); resetPage(); }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterStatus === key ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              )}
            >
              {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", dot, filterStatus === key && "bg-white")} />}
              {t(labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("noCourseFound")}</p>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">{t("adjustFilters")}</p>
        </div>
      )}

      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((course) => (
            <CourseCard key={course.id} course={course} isAdmin={true} isManagerOrCreator={false}
              progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={false} showTypeBadge
              onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
          ))}
        </div>
      ) : isManagerOrCreator ? (
        <div className="space-y-6">
          <div className="flex border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
            {([
              { key: "mes-formations" as const, label: t("myTrainings"), count: myFormations.length },
              { key: "bibliotheque"   as const, label: t("library"),     count: libraryFiltered.length },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); resetPage(); }}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === key ? "border-[#0071E3] text-[#0071E3]" : "border-transparent text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                )}
              >
                {label}
                <span className={cn(
                  "text-[12px] font-medium px-1.5 py-0.5 rounded-md",
                  activeTab === key ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#ADADB8]"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "mes-formations" && (() => {
            const groups = [
              { key: "not_started" as const, label: t("notStarted"), color: "bg-[#0071E3]" },
              { key: "in_progress"  as const, label: t("inProgress"), color: "bg-amber-400" },
              { key: "completed"    as const, label: t("completed"),  color: "bg-emerald-400" },
            ];
            return paginated.length === 0 ? (
              <p className="text-[14px] text-[#6E6E73] py-8">{t("noAssignedTraining")}</p>
            ) : (
              <div className="space-y-8">
                {groups.map(({ key, label, color }) => {
                  if (filterStatus !== "all" && filterStatus !== key) return null;
                  const group = paginated.filter((c) => (progressMap[c.id]?.status ?? "not_started") === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                        <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{label}</h3>
                        <span className="text-[12px] text-[#ADADB8] font-medium">{group.length}</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {group.map((course) => (
                          <CourseCard key={course.id} course={course} isAdmin={false} isManagerOrCreator={false}
                            progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={true}
                            onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {activeTab === "bibliotheque" && (
            <div className="space-y-4">
              <p className="text-[13px] text-[#ADADB8]">
                {t("coursesYouCanAssign")} ({libraryFiltered.length}).
              </p>
              {paginated.length === 0 ? (
                <p className="text-[14px] text-[#6E6E73] py-8">{t("noCoursesToAssign")}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginated.map((course) => (
                    <CourseCard key={course.id} course={course} isAdmin={false} isManagerOrCreator={true}
                      progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={assignedSet.has(course.id)}
                      hideDeadline isDeletable={assignableCourseIds?.has(course.id) ?? false} showTypeBadge
                      onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {(
            [
              { key: "not_started" as const, label: t("notStarted"), color: "bg-[#0071E3]"  },
              { key: "in_progress" as const, label: t("inProgress"), color: "bg-amber-400"  },
              { key: "completed"   as const, label: t("completed"),  color: "bg-emerald-400" },
            ]
          ).map(({ key, label, color }) => {
            if (filterStatus !== "all" && filterStatus !== key) return null;
            const group = paginated.filter((c) => (progressMap[c.id]?.status ?? "not_started") === key);
            if (group.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                  <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{label}</h2>
                  <span className="text-[12px] text-[#ADADB8] font-medium">{group.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((course) => (
                    <CourseCard key={course.id} course={course} isAdmin={false} isManagerOrCreator={false}
                      progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={true}
                      onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} sur {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-1 text-[#ADADB8] text-[13px]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={cn(
                      "min-w-[32px] px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                      page === p ? "bg-[#0071E3] text-white shadow-sm" : "text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {assignTarget && (
        <AssignModal
          courseId={assignTarget.id}
          courseTitle={assignTarget.title}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {managerAssignTarget && (
        <AssignModalManager
          courseId={managerAssignTarget.id}
          courseTitle={managerAssignTarget.title}
          onClose={() => setManagerAssignTarget(null)}
        />
      )}
    </div>
  );
}
