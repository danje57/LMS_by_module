"use client";

import { useState } from "react";
import type { Course } from "@prisma/client";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { Search, Clock, CircleCheck, Play, Pencil, ArrowUpDown, UserPlus, Award, CalendarClock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
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

function CourseCard({
  course,
  isAdmin,
  isManagerOrCreator,
  progressMap,
  meta,
  isAssignedToMe,
  hideDeadline = false,
  isDeletable = false,
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
  onAssign: (t: { id: string; title: string }) => void;
  onManagerAssign: (t: { id: string; title: string }) => void;
}) {
  const prog = progressMap[course.id];
  const status = prog?.status ?? "not_started";
  const isCompleted = status === "completed";
  const deadlineState = !isCompleted && isAssignedToMe && !hideDeadline ? getDeadlineState(meta?.dueDate ?? null, meta?.assignedAt ?? null) : null;

  return (
    <div className={cn(
      "group bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all",
      !hideDeadline && deadlineState === "overdue" ? "border-red-300 hover:border-red-400" :
      !hideDeadline && deadlineState === "danger"  ? "border-orange-300 hover:border-orange-400" :
      "border-[#E5E5EA] hover:border-[#D2D2D7]"
    )}>
      {/* Color band */}
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

      <div className="p-5 space-y-4">
        <h3 className="text-[15px] font-semibold text-[#1D1D1F] leading-snug line-clamp-2">
          {course.title}
        </h3>

        {/* Deadline badge */}
        {deadlineState && meta?.dueDate && (
          <div className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1 w-fit",
            deadlineState === "overdue" ? "text-red-600 bg-red-50" :
            deadlineState === "danger"  ? "text-orange-600 bg-orange-50" :
            deadlineState === "warning" ? "text-amber-600 bg-amber-50" :
            "text-[#6E6E73] bg-[#F5F5F7]"
          )}>
            {deadlineState === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
            {deadlineState === "overdue"
              ? `En retard · ${new Date(meta.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
              : `Échéance · ${new Date(meta.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
            }
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] bg-[#F5F5F7] rounded-lg px-2.5 py-1">
            <Clock className="w-3 h-3" />
            {formatDuration(course.duration)}
          </span>
          {course.hasQuiz && (
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1",
              !isAdmin && isCompleted && prog?.quizPassed === true ? "text-emerald-600 bg-emerald-50" :
              !isAdmin && isCompleted && prog?.quizPassed === false ? "text-red-500 bg-red-50" :
              "text-amber-600 bg-amber-50"
            )}>
              <CircleCheck className="w-3 h-3" />
              {!isAdmin && isCompleted && prog?.quizPassed !== null
                ? (prog?.quizPassed ? "Quiz réussi" : "Quiz échoué")
                : `Quiz · ${course.passingScore}%`}
            </span>
          )}
        </div>

        {(meta?.createdByName || (isAssignedToMe && meta?.assignedByName)) && (
          <p className="text-[11px] text-[#ADADB8] leading-relaxed">
            {meta?.createdByName && <span>Créé par <span className="text-[#6E6E73]">{meta.createdByName}</span></span>}
            {meta?.createdByName && isAssignedToMe && meta?.assignedByName && <span> · </span>}
            {isAssignedToMe && meta?.assignedByName && <span>Affecté par <span className="text-[#6E6E73]">{meta.assignedByName}</span></span>}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#ADADB8]">{formatFileSize(course.fileSize)}</span>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <>
                <button
                  onClick={() => onAssign({ id: course.id, title: course.title })}
                  className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                  title="Assigner"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/dashboard/admin/courses/${course.id}/edit`}
                  className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                  title="Éditer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
              </>
            )}
            {isManagerOrCreator && isDeletable && (
              <DeleteCourseButton courseId={course.id} courseTitle={course.title} isManagerContext />
            )}
            {isManagerOrCreator && (
              <button
                onClick={() => onManagerAssign({ id: course.id, title: course.title })}
                className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors"
                title="Affecter"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {!isAdmin && !hideDeadline && isAssignedToMe && isCompleted && prog?.latestCertificateId && (
              <Link
                href={`/dashboard/certificates/${prog.latestCertificateId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-[13px] font-medium rounded-xl transition-colors"
                title="Voir le certificat"
              >
                <Award className="w-3.5 h-3.5" />
                Certificat
              </Link>
            )}
            {!isAdmin && !hideDeadline && isAssignedToMe && (
              <Link
                href={`/dashboard/courses/${course.id}/play`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {status === "in_progress" ? "Reprendre" : status === "completed" ? "Revoir" : "Lancer"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CourseList({ courses, isAdmin = false, isManagerOrCreator = false, progressMap = {}, metaMap = {}, assignedCourseIds, assignableCourseIds }: CourseListProps) {
  const assignedSet = new Set(assignedCourseIds ?? []);
  const [search, setSearch] = useState("");
  const [filterQuiz, setFilterQuiz] = useState<"all" | "yes" | "no">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "not_started" | "in_progress" | "completed">("all");
  const [durationSort, setDurationSort] = useState<"none" | "asc" | "desc">("none");
  const [assignTarget, setAssignTarget] = useState<{ id: string; title: string } | null>(null);
  const [managerAssignTarget, setManagerAssignTarget] = useState<{ id: string; title: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"mes-formations" | "bibliotheque">("mes-formations");

  const filtered = courses
    .filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      const matchQuiz =
        filterQuiz === "all" || (filterQuiz === "yes" ? c.hasQuiz : !c.hasQuiz);
      return matchSearch && matchQuiz;
    })
    .sort((a, b) => {
      if (durationSort === "asc") return a.duration - b.duration;
      if (durationSort === "desc") return b.duration - a.duration;
      return 0;
    });

  return (
    <div className="space-y-5">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher un cours…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] bg-white text-[14px] text-[#1D1D1F] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <div className="flex gap-1.5 bg-white border border-[#D2D2D7] rounded-xl p-1">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterQuiz(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterQuiz === v
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              {v === "all" ? "Tous" : v === "yes" ? "Avec quiz" : "Sans quiz"}
            </button>
          ))}
        </div>

        <button
          onClick={() =>
            setDurationSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))
          }
          className={cn(
            "inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-[13px] font-medium transition-all whitespace-nowrap",
            durationSort !== "none"
              ? "bg-[#0071E3] border-[#0071E3] text-white shadow-sm"
              : "bg-white border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F]"
          )}
          title="Trier par durée"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Durée
          {durationSort === "asc" && <span className="text-[11px]">↑</span>}
          {durationSort === "desc" && <span className="text-[11px]">↓</span>}
        </button>
      </div>

      {!isAdmin && (!isManagerOrCreator || (assignedSet.size > 0 && activeTab === "mes-formations")) && (
        <div className="flex gap-1.5 bg-white border border-[#D2D2D7] rounded-xl p-1 w-fit">
          {([
            { key: "all",         label: "Tous",            dot: null },
            { key: "not_started", label: "Non commencé",    dot: "bg-[#0071E3]" },
            { key: "in_progress", label: "En cours",        dot: "bg-amber-400" },
            { key: "completed",   label: "Terminé",         dot: "bg-emerald-400" },
          ] as const).map(({ key, label, dot }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterStatus === key
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", dot, filterStatus === key && "bg-white")} />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">Aucun cours trouvé</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Modifiez vos filtres ou ajoutez un cours.</p>
        </div>
      )}

      {isAdmin ? (
        /* Admin : grille plate */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} isAdmin={true} isManagerOrCreator={false}
              progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={false} onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
          ))}
        </div>
      ) : isManagerOrCreator ? (
        /* Manager/Créateur : onglets "Mes formations" / "Bibliothèque" */
        <div className="space-y-6">
          {/* Tab bar */}
          <div className="flex border-b border-[#E5E5EA]">
            {([
              { key: "mes-formations" as const, label: "Mes formations", count: filtered.filter((c) => assignedSet.has(c.id)).length },
              { key: "bibliotheque"   as const, label: "Bibliothèque",   count: filtered.length },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === key
                    ? "border-[#0071E3] text-[#0071E3]"
                    : "border-transparent text-[#6E6E73] hover:text-[#1D1D1F]"
                )}
              >
                {label}
                <span className={cn(
                  "text-[12px] font-medium px-1.5 py-0.5 rounded-md",
                  activeTab === key ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#F5F5F7] text-[#ADADB8]"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Onglet Mes formations */}
          {activeTab === "mes-formations" && (() => {
            const myFormations = filtered.filter((c) => assignedSet.has(c.id));
            const groups = [
              { key: "not_started" as const, label: "Non commencé", color: "bg-[#0071E3]" },
              { key: "in_progress"  as const, label: "En cours",     color: "bg-amber-400" },
              { key: "completed"    as const, label: "Terminé",      color: "bg-emerald-400" },
            ];
            return myFormations.length === 0 ? (
              <p className="text-[14px] text-[#6E6E73] py-8">Aucune formation ne vous est assignée.</p>
            ) : (
              <div className="space-y-8">
                {groups.map(({ key, label, color }) => {
                  if (filterStatus !== "all" && filterStatus !== key) return null;
                  const group = myFormations.filter((c) => (progressMap[c.id]?.status ?? "not_started") === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                        <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{label}</h3>
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

          {/* Onglet Bibliothèque */}
          {activeTab === "bibliotheque" && (() => {
            const libraryFiltered = assignableCourseIds
              ? filtered.filter((c) => assignableCourseIds.has(c.id))
              : filtered;
            return (
              <div className="space-y-4">
                <p className="text-[13px] text-[#ADADB8]">
                  Cours que vous pouvez affecter ({libraryFiltered.length}).
                </p>
                {libraryFiltered.length === 0 ? (
                  <p className="text-[14px] text-[#6E6E73] py-8">Aucun cours à affecter — créez un cours pour commencer.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {libraryFiltered.map((course) => (
                      <CourseCard key={course.id} course={course} isAdmin={false} isManagerOrCreator={true}
                        progressMap={progressMap} meta={metaMap[course.id]} isAssignedToMe={assignedSet.has(course.id)}
                        hideDeadline isDeletable={assignableCourseIds?.has(course.id) ?? false}
                        onAssign={setAssignTarget} onManagerAssign={setManagerAssignTarget} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* Apprenant : groupé par statut */
        <div className="space-y-8">
          {(
            [
              { key: "not_started",  label: "Non commencé",   color: "bg-[#0071E3]"  },
              { key: "in_progress",  label: "En cours",       color: "bg-amber-400"  },
              { key: "completed",    label: "Terminé",        color: "bg-emerald-400" },
            ] as const
          ).map(({ key, label, color }) => {
            if (filterStatus !== "all" && filterStatus !== key) return null;
            const group = filtered.filter((c) => (progressMap[c.id]?.status ?? "not_started") === key);
            if (group.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                  <h2 className="text-[15px] font-semibold text-[#1D1D1F]">{label}</h2>
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
