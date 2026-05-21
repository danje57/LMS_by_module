"use client";

import { useState, useMemo } from "react";
import { Search, Layers, Users, BookOpen, TrendingUp, CheckCircle2, Clock, Circle, AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
export type CourseStatus = "not_started" | "in_progress" | "completed";
export type DeadlineState = "overdue" | "danger" | "warning" | "normal" | null;

export type AssignmentRow = {
  courseId: string;
  courseTitle: string;
  status: CourseStatus;
  progress: number;
  dueDate: string | null;
  assignedAt: string | null;
};

export function getDeadlineState(dueDate: string | null, assignedAt: string | null): DeadlineState {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const remaining = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (remaining < 0) return "overdue";
  const assigned = assignedAt ? new Date(assignedAt) : null;
  const total = assigned ? Math.round((due.getTime() - assigned.getTime()) / 86400000) : 0;
  const threshold = Math.max(total * 0.15, 3);
  if (remaining <= 3)         return "danger";
  if (remaining <= threshold) return "warning";
  return "normal";
}

export type UserProgressRow = {
  id: string;
  name: string | null;
  email: string;
  teams: { id: string; name: string }[];
  assignments: AssignmentRow[];
};

export type CourseRef = { id: string; title: string };
export type TeamRef   = { id: string; name: string };

interface Props {
  courses: CourseRef[];
  teams: TeamRef[];
  users: UserProgressRow[];
}

export function ProgressClient({ courses, teams, users }: Props) {
  const t = useTranslations("progress");
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const STATUS_LABEL: Record<CourseStatus, string> = {
    not_started: t("assigned"),
    in_progress: "En cours",
    completed: t("completed"),
  };

  const STATUS_STYLE: Record<CourseStatus, string> = {
    not_started: "bg-[#F5F5F7] text-[#6E6E73]",
    in_progress: "bg-amber-50 text-amber-600",
    completed: "bg-emerald-50 text-emerald-600",
  };

  const STATUS_ICON: Record<CourseStatus, React.FC<{ className?: string }>> = {
    not_started: Circle,
    in_progress: Clock,
    completed: CheckCircle2,
  };

  function toggleExpand(id: string) {
    setExpandedUsers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Filter users
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchTeam =
        filterTeam === "all" ||
        (filterTeam === "none" ? u.teams.length === 0 : u.teams.some((t) => t.id === filterTeam));
      const matchCourse =
        filterCourse === "all" || u.assignments.some((a) => a.courseId === filterCourse);
      return matchSearch && matchTeam && matchCourse;
    });
  }, [users, search, filterTeam, filterCourse]);

  // Global stats (from all users, not filtered)
  const globalStats = useMemo(() => {
    let totalAssignments = 0;
    let completedAssignments = 0;
    let inProgressAssignments = 0;
    for (const u of users) {
      totalAssignments += u.assignments.length;
      completedAssignments += u.assignments.filter((a) => a.status === "completed").length;
      inProgressAssignments += u.assignments.filter((a) => a.status === "in_progress").length;
    }
    const rate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
    return { totalLearners: users.length, totalCourses: courses.length, totalAssignments, completedAssignments, inProgressAssignments, rate };
  }, [users, courses]);

  const isCourseView = filterCourse !== "all";
  const selectedCourseTitle = courses.find((c) => c.id === filterCourse)?.title ?? "";

  // Grouped rendering helper
  function buildGroups(rows: UserProgressRow[]) {
    const groups: { teamId: string | null; teamName: string; users: UserProgressRow[] }[] = [];
    const byTeam = new Map<string, UserProgressRow[]>();
    const noTeam: UserProgressRow[] = [];
    for (const u of rows) {
      if (u.teams.length === 0) {
        noTeam.push(u);
      } else {
        for (const tm of u.teams) {
          if (!byTeam.has(tm.id)) byTeam.set(tm.id, []);
          byTeam.get(tm.id)!.push(u);
        }
      }
    }
    for (const tm of teams) {
      const members = byTeam.get(tm.id);
      if (members && members.length > 0) groups.push({ teamId: tm.id, teamName: tm.name, users: members });
    }
    if (noTeam.length > 0) groups.push({ teamId: null, teamName: "Sans équipe", users: noTeam });
    return groups;
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t("learners"), value: globalStats.totalLearners, icon: Users, color: "bg-purple-50 text-purple-600" },
          { label: t("activeCourses"), value: globalStats.totalCourses, icon: BookOpen, color: "bg-blue-50 text-[#0071E3]" },
          { label: t("completionRate"), value: `${globalStats.rate}%`, icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
          { label: t("certificatesIssued"), value: globalStats.completedAssignments, icon: CheckCircle2, color: "bg-amber-50 text-amber-600" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[12px] text-[#6E6E73] font-medium">{s.label}</p>
                <p className="text-[24px] font-semibold text-[#1D1D1F] leading-none mt-0.5">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder={t("searchLearner")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] bg-white text-[14px] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">Toutes les équipes</option>
          <option value="none">Sans équipe</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select>

        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">{t("allCourses")}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>

        <button
          onClick={() => setGroupByTeam((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-4 border text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap",
            groupByTeam
              ? "bg-[#0071E3] border-[#0071E3] text-white"
              : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#0071E3] hover:text-[#0071E3]"
          )}
        >
          <Layers className="w-4 h-4" />
          Grouper
        </button>

      </div>

      {/* Count + légende deadline */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[13px] text-[#6E6E73]">
          {filtered.length} apprenant{filtered.length !== 1 ? "s" : ""}
          {isCourseView && <> · cours&nbsp;: <span className="font-medium text-[#1D1D1F]">{selectedCourseTitle}</span></>}
        </p>
        <div className="flex items-center gap-3 text-[11px] text-[#6E6E73]">
          <span className="font-medium">Deadline :</span>
          {([
            { label: t("overdue"),  dot: "bg-red-400" },
            { label: t("soonDays"),  dot: "bg-orange-400" },
            { label: t("soon"),    dot: "bg-amber-400" },
            { label: t("ok"),         dot: "bg-[#D2D2D7]" },
          ] as const).map(({ label, dot }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">{t("noLearnerFound")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span>{t("learner")}</span>
                    {!isCourseView && (
                      <button
                        onClick={() => {
                          const allIds = filtered.map((u) => u.id);
                          const allExpanded = allIds.every((id) => expandedUsers.has(id));
                          setExpandedUsers(allExpanded ? new Set() : new Set(allIds));
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors"
                      >
                        <ChevronRight className={cn("w-3 h-3 transition-transform", filtered.every((u) => expandedUsers.has(u.id)) && "rotate-90")} />
                        {filtered.every((u) => expandedUsers.has(u.id)) ? t("collapseAll") : t("expandAll")}
                      </button>
                    )}
                  </div>
                </th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("team")}</th>
                {isCourseView ? (
                  <>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("status")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("deadline")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3 w-40">{t("progressLabel")}</th>
                  </>
                ) : (
                  <>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("assigned")}</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("completed")}</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] px-5 py-3">En cours</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] px-5 py-3">{t("overdue")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] px-5 py-3 w-36">{t("progressLabel")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7]">
              {groupByTeam
                ? buildGroups(filtered).flatMap(({ teamId, teamName, users: gUsers }) => [
                    <tr key={`g-${teamId ?? "none"}`} className="bg-[#F5F5F7]">
                      <td colSpan={isCourseView ? 4 : 7} className="px-5 py-2">
                        <span className="text-[12px] font-semibold text-[#6E6E73] uppercase tracking-wide">
                          {teamName}
                          <span className="ml-2 font-normal normal-case">({gUsers.length})</span>
                        </span>
                      </td>
                    </tr>,
                    ...gUsers.map((u) => (
                      <UserRow key={u.id} user={u} courseId={filterCourse !== "all" ? filterCourse : null}
                        expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                        statusLabel={STATUS_LABEL} statusStyle={STATUS_STYLE} statusIcon={STATUS_ICON} />
                    )),
                  ])
                : filtered.map((u) => (
                    <UserRow key={u.id} user={u} courseId={filterCourse !== "all" ? filterCourse : null}
                      expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                      statusLabel={STATUS_LABEL} statusStyle={STATUS_STYLE} statusIcon={STATUS_ICON} />
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserRow({ user, courseId, expanded, onToggle, statusLabel, statusStyle, statusIcon }: {
  user: UserProgressRow;
  courseId: string | null;
  expanded: boolean;
  onToggle: () => void;
  statusLabel: Record<CourseStatus, string>;
  statusStyle: Record<CourseStatus, string>;
  statusIcon: Record<CourseStatus, React.FC<{ className?: string }>>;
}) {
  const isCourseView = courseId !== null;

  const assignment = isCourseView
    ? user.assignments.find((a) => a.courseId === courseId)
    : null;

  const completed  = user.assignments.filter((a) => a.status === "completed").length;
  const inProgress = user.assignments.filter((a) => a.status === "in_progress").length;
  const overdue    = user.assignments.filter((a) => a.status !== "completed" && getDeadlineState(a.dueDate, a.assignedAt) === "overdue").length;
  const total      = user.assignments.length;
  const globalPct  = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
    <tr
      className={cn("transition-colors", !isCourseView ? "cursor-pointer hover:bg-[#F5F5F7]" : "hover:bg-[#F9F9FB]", expanded && !isCourseView && "bg-[#F5F5F7]")}
      onClick={!isCourseView ? onToggle : undefined}
    >
      {/* Apprenant */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          {!isCourseView && (
            <ChevronRight className={cn("w-4 h-4 text-[#ADADB8] shrink-0 transition-transform", expanded && "rotate-90")} />
          )}
          <div>
            <p className="text-[14px] font-medium text-[#1D1D1F]">
              {user.name ?? <span className="italic text-[#ADADB8]">Sans nom</span>}
            </p>
            <p className="text-[12px] text-[#6E6E73]">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Équipe */}
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1">
          {user.teams.length === 0 ? (
            <span className="text-[12px] text-[#ADADB8] italic">—</span>
          ) : user.teams.map((tm) => (
            <span key={tm.id} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
              {tm.name}
            </span>
          ))}
        </div>
      </td>

      {isCourseView ? (
        <>
          {/* Statut pour le cours filtré */}
          <td className="px-5 py-3.5">
            {assignment ? (
              <StatusBadge status={assignment.status} statusLabel={statusLabel} statusStyle={statusStyle} statusIcon={statusIcon} />
            ) : (
              <span className="text-[12px] text-[#ADADB8] italic">Non assigné</span>
            )}
          </td>
          {/* Deadline */}
          <td className="px-5 py-3.5">
            {assignment ? (
              <DeadlineBadge dueDate={assignment.dueDate} assignedAt={assignment.assignedAt} completed={assignment.status === "completed"} />
            ) : (
              <span className="text-[12px] text-[#ADADB8]">—</span>
            )}
          </td>
          {/* Progression cours */}
          <td className="px-5 py-3.5">
            {assignment ? (
              <ProgressBar pct={assignment.progress} />
            ) : (
              <span className="text-[12px] text-[#ADADB8]">—</span>
            )}
          </td>
        </>
      ) : (
        <>
          {/* Assignés */}
          <td className="px-5 py-3.5 text-center">
            <span className="text-[14px] font-medium text-[#1D1D1F]">{total}</span>
          </td>
          {/* Terminés */}
          <td className="px-5 py-3.5 text-center">
            <span className={cn("text-[14px] font-medium", completed > 0 ? "text-emerald-600" : "text-[#ADADB8]")}>
              {completed}
            </span>
          </td>
          {/* En cours */}
          <td className="px-5 py-3.5 text-center">
            <span className={cn("text-[14px] font-medium", inProgress > 0 ? "text-amber-500" : "text-[#ADADB8]")}>
              {inProgress}
            </span>
          </td>
          {/* En retard */}
          <td className="px-5 py-3.5 text-center">
            {overdue > 0 ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                {overdue}
              </span>
            ) : (
              <span className="text-[14px] text-[#ADADB8]">—</span>
            )}
          </td>
          {/* Progression globale */}
          <td className="px-5 py-3.5">
            {total > 0 ? (
              <ProgressBar pct={globalPct} />
            ) : (
              <span className="text-[12px] text-[#ADADB8] italic">Aucun cours</span>
            )}
          </td>
        </>
      )}
    </tr>

    {/* Sous-lignes cours (accordion, vue globale uniquement) */}
    {!isCourseView && expanded && user.assignments.map((a) => (
      <tr key={`${user.id}-${a.courseId}`} className="bg-[#FAFAFA] border-t border-[#F0F0F5]">
        <td className="pl-12 pr-5 py-2.5" colSpan={2}>
          <p className="text-[13px] font-medium text-[#1D1D1F]">{a.courseTitle}</p>
        </td>
        <td className="px-5 py-2.5">
          <StatusBadge status={a.status} statusLabel={statusLabel} statusStyle={statusStyle} statusIcon={statusIcon} />
        </td>
        <td className="px-5 py-2.5" colSpan={2}>
          <DeadlineEditor
            courseId={a.courseId}
            userId={user.id}
            dueDate={a.dueDate}
            assignedAt={a.assignedAt}
            completed={a.status === "completed"}
          />
        </td>
        <td className="px-5 py-2.5" colSpan={2}>
          <ProgressBar pct={a.progress} />
        </td>
      </tr>
    ))}
    </>
  );
}

function StatusBadge({ status, statusLabel, statusStyle, statusIcon }: {
  status: CourseStatus;
  statusLabel: Record<CourseStatus, string>;
  statusStyle: Record<CourseStatus, string>;
  statusIcon: Record<CourseStatus, React.FC<{ className?: string }>>;
}) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg", statusStyle[status])}>
      <Icon className="w-3 h-3" />
      {statusLabel[status]}
    </span>
  );
}

function DeadlineBadge({ dueDate, assignedAt, completed }: { dueDate: string | null; assignedAt: string | null; completed: boolean }) {
  if (!dueDate) return <span className="text-[12px] text-[#ADADB8]">—</span>;
  if (completed) return <span className="text-[12px] text-[#ADADB8]">—</span>;
  const state = getDeadlineState(dueDate, assignedAt);
  const date = new Date(dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const styles: Record<NonNullable<DeadlineState>, string> = {
    overdue: "text-red-600 bg-red-50",
    danger:  "text-orange-600 bg-orange-50",
    warning: "text-amber-600 bg-amber-50",
    normal:  "text-[#6E6E73] bg-[#F5F5F7]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg", styles[state ?? "normal"])}>
      {state === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
      {state === "overdue" ? `En retard · ${date}` : date}
    </span>
  );
}

function DeadlineEditor({ courseId, userId, dueDate, assignedAt, completed }: {
  courseId: string;
  userId: string;
  dueDate: string | null;
  assignedAt: string | null;
  completed: boolean;
}) {
  const [value, setValue] = useState(dueDate ? dueDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  async function handleChange(newDate: string) {
    setValue(newDate);
    setSaving(true);
    await fetch(`/api/courses/${courseId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, dueDate: newDate || null }),
    });
    setSaving(false);
  }

  if (completed) return <span className="text-[12px] text-[#ADADB8]">—</span>;

  const state = getDeadlineState(value || null, assignedAt);
  const styles: Record<NonNullable<DeadlineState>, string> = {
    overdue: "border-red-300 bg-red-50 text-red-600",
    danger:  "border-orange-300 bg-orange-50 text-orange-600",
    warning: "border-amber-300 bg-amber-50 text-amber-600",
    normal:  "border-[#D2D2D7] bg-white text-[#1D1D1F]",
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "h-7 px-2 rounded-lg border text-[12px] outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition-all",
          styles[state ?? "normal"]
        )}
      />
      {saving && <div className="w-3 h-3 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin shrink-0" />}
      {!saving && value && state === "overdue" && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-400" : "bg-[#0071E3]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-[#6E6E73] w-8 text-right">{pct}%</span>
    </div>
  );
}
