"use client";

import { useState, useMemo } from "react";
import {
  Search, Layers, Users, BookOpen, TrendingUp, CheckCircle2,
  Clock, Circle, AlertTriangle, CalendarClock, ChevronRight,
  Download, FileText, PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type CourseStatus  = "not_started" | "in_progress" | "completed";
export type DocStatus     = "not_started" | "in_progress" | "signed";
export type DeadlineState = "overdue" | "danger" | "warning" | "normal" | null;

export type AssignmentRow = {
  courseId:    string;
  courseTitle: string;
  status:      CourseStatus;
  progress:    number;
  dueDate:     string | null;
  assignedAt:  string | null;
};

export type DocAssignmentRow = {
  docId:      string;
  docTitle:   string;
  status:     DocStatus;
  signedAt:   string | null;
  dueDate:    string | null;
  assignedAt: string | null;
};

export function getDeadlineState(dueDate: string | null, assignedAt: string | null): DeadlineState {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const remaining = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (remaining < 0) return "overdue";
  const assigned  = assignedAt ? new Date(assignedAt) : null;
  const total     = assigned ? Math.round((due.getTime() - assigned.getTime()) / 86400000) : 0;
  const threshold = Math.max(total * 0.15, 3);
  if (remaining <= 3)         return "danger";
  if (remaining <= threshold) return "warning";
  return "normal";
}

export type UserProgressRow = {
  id:             string;
  name:           string | null;
  email:          string;
  teams:          { id: string; name: string }[];
  assignments:    AssignmentRow[];
  docAssignments: DocAssignmentRow[];
};

export type CourseRef = { id: string; title: string };
export type TeamRef   = { id: string; name: string };

interface Props {
  courses:  CourseRef[];
  docs?:    CourseRef[];
  teams:    TeamRef[];
  users:    UserProgressRow[];
}

export function ProgressClient({ courses, docs = [], teams, users }: Props) {
  const t = useTranslations("progress");

  const [activeTab,     setActiveTab]     = useState<"courses" | "documents">("courses");
  const [search,        setSearch]        = useState("");
  const [filterTeam,    setFilterTeam]    = useState("all");
  const [filterCourse,  setFilterCourse]  = useState("all");
  const [filterDoc,     setFilterDoc]     = useState("all");
  const [groupByTeam,   setGroupByTeam]   = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  function switchTab(tab: "courses" | "documents") {
    setActiveTab(tab);
    setSearch("");
    setFilterTeam("all");
    setFilterCourse("all");
    setFilterDoc("all");
    setExpandedUsers(new Set());
  }

  function toggleExpand(id: string) {
    setExpandedUsers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // ── Course status maps ────────────────────────────────────────────────────
  const STATUS_LABEL: Record<CourseStatus, string> = {
    not_started: t("assigned"),
    in_progress: "En cours",
    completed:   t("completed"),
  };
  const STATUS_STYLE: Record<CourseStatus, string> = {
    not_started: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]",
    in_progress: "bg-amber-50 dark:bg-amber-500/10 text-amber-600",
    completed:   "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600",
  };
  const STATUS_ICON: Record<CourseStatus, React.FC<{ className?: string }>> = {
    not_started: Circle,
    in_progress: Clock,
    completed:   CheckCircle2,
  };

  // ── Doc status maps ───────────────────────────────────────────────────────
  const DOC_LABEL: Record<DocStatus, string> = {
    not_started: "Non lu",
    in_progress: "En cours",
    signed:      "Signé",
  };
  const DOC_STYLE: Record<DocStatus, string> = {
    not_started: "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]",
    in_progress: "bg-amber-50 dark:bg-amber-500/10 text-amber-600",
    signed:      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600",
  };
  const DOC_ICON: Record<DocStatus, React.FC<{ className?: string }>> = {
    not_started: Circle,
    in_progress: Clock,
    signed:      PenLine,
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const courseStats = useMemo(() => {
    let total = 0, completed = 0, inProgress = 0;
    for (const u of users) {
      total      += u.assignments.length;
      completed  += u.assignments.filter((a) => a.status === "completed").length;
      inProgress += u.assignments.filter((a) => a.status === "in_progress").length;
    }
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { totalLearners: users.length, totalCourses: courses.length, total, completed, inProgress, rate };
  }, [users, courses]);

  const docStats = useMemo(() => {
    let total = 0, signed = 0, inProgress = 0;
    for (const u of users) {
      total      += u.docAssignments.length;
      signed     += u.docAssignments.filter((d) => d.status === "signed").length;
      inProgress += u.docAssignments.filter((d) => d.status === "in_progress").length;
    }
    const rate = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { totalLearners: users.length, totalDocs: docs.length, total, signed, inProgress, rate };
  }, [users, docs]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchTeam =
        filterTeam === "all" ||
        (filterTeam === "none"
          ? u.teams.length === 0
          : u.teams.some((tm) => tm.id === filterTeam));
      if (activeTab === "courses") {
        const matchCourse =
          filterCourse === "all" || u.assignments.some((a) => a.courseId === filterCourse);
        return matchSearch && matchTeam && matchCourse;
      } else {
        const matchDoc =
          filterDoc === "all" || u.docAssignments.some((d) => d.docId === filterDoc);
        return matchSearch && matchTeam && matchDoc;
      }
    });
  }, [users, search, filterTeam, filterCourse, filterDoc, activeTab]);

  const isCourseView      = filterCourse !== "all";
  const isDocView         = filterDoc    !== "all";
  const selectedCourseTitle = courses.find((c) => c.id === filterCourse)?.title ?? "";
  const selectedDocTitle    = docs.find((d) => d.id === filterDoc)?.title ?? "";

  // ── Grouping ──────────────────────────────────────────────────────────────
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

  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = activeTab === "courses"
    ? [
        { label: t("learners"),          value: courseStats.totalLearners, icon: Users,       color: "bg-purple-50 text-purple-600" },
        { label: t("activeCourses"),      value: courseStats.totalCourses,  icon: BookOpen,    color: "bg-blue-50 text-[#0071E3]" },
        { label: t("completionRate"),     value: `${courseStats.rate}%`,    icon: TrendingUp,  color: "bg-emerald-50 text-emerald-600" },
        { label: t("certificatesIssued"), value: courseStats.completed,     icon: CheckCircle2, color: "bg-amber-50 text-amber-600" },
      ]
    : [
        { label: t("learners"),      value: docStats.totalLearners, icon: Users,      color: "bg-purple-50 text-purple-600" },
        { label: "Documents actifs", value: docStats.totalDocs,     icon: FileText,   color: "bg-blue-50 text-[#0071E3]" },
        { label: "Taux de signature", value: `${docStats.rate}%`,  icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
        { label: "Signés",            value: docStats.signed,       icon: PenLine,    color: "bg-amber-50 text-amber-600" },
      ];

  const colSpanCourse = isCourseView ? 5 : 7;
  const colSpanDoc    = isDocView    ? 5 : 7;

  // ── Shared expand-all toggle ───────────────────────────────────────────────
  function handleExpandAll() {
    const allIds = filtered.map((u) => u.id);
    const allExpanded = allIds.every((id) => expandedUsers.has(id));
    setExpandedUsers(allExpanded ? new Set() : new Set(allIds));
  }
  const allExpanded = filtered.length > 0 && filtered.every((u) => expandedUsers.has(u.id));

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] font-medium">{s.label}</p>
                <p className="text-[24px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none mt-0.5">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
        {([
          { key: "courses"   as const, label: "Cours" },
          { key: "documents" as const, label: "Documents GRC" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-[#0071E3] text-[#0071E3]"
                : "border-transparent text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            )}
          >
            {tab.label}
          </button>
        ))}
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
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
        >
          <option value="all">Toutes les équipes</option>
          <option value="none">Sans équipe</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select>

        {activeTab === "courses" ? (
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
          >
            <option value="all">{t("allCourses")}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        ) : (
          <select
            value={filterDoc}
            onChange={(e) => setFilterDoc(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-all"
          >
            <option value="all">Tous les documents</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        )}

        <button
          onClick={() => setGroupByTeam((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-4 border text-[14px] font-medium rounded-xl transition-colors whitespace-nowrap",
            groupByTeam
              ? "bg-[#0071E3] border-[#0071E3] text-white"
              : "bg-white dark:bg-[#2C2C2E] border-[#D2D2D7] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#0071E3] hover:text-[#0071E3]"
          )}
        >
          <Layers className="w-4 h-4" />
          Grouper
        </button>

        <a
          href={activeTab === "courses" ? "/api/export/progress" : "/api/export/documents-progress"}
          download
          className="inline-flex items-center gap-2 h-10 px-4 border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl hover:border-[#0071E3] hover:text-[#0071E3] transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </a>
      </div>

      {/* Count + deadline legend (courses only) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
          {filtered.length} apprenant{filtered.length !== 1 ? "s" : ""}
          {activeTab === "courses" && isCourseView && (
            <> · cours&nbsp;: <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedCourseTitle}</span></>
          )}
          {activeTab === "documents" && isDocView && (
            <> · document&nbsp;: <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedDocTitle}</span></>
          )}
        </p>
        {activeTab === "courses" && (
          <div className="flex items-center gap-3 text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
            <span className="font-medium">Deadline :</span>
            {([
              { label: t("overdue"),  dot: "bg-red-400" },
              { label: t("soonDays"), dot: "bg-orange-400" },
              { label: t("soon"),     dot: "bg-amber-400" },
              { label: t("ok"),       dot: "bg-[#D2D2D7]" },
            ] as const).map(({ label, dot }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("noLearnerFound")}</p>
        </div>

      ) : activeTab === "courses" ? (
        /* ── Courses table ──────────────────────────────────────────────── */
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span>{t("learner")}</span>
                    {!isCourseView && (
                      <button
                        onClick={handleExpandAll}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors"
                      >
                        <ChevronRight className={cn("w-3 h-3 transition-transform", allExpanded && "rotate-90")} />
                        {allExpanded ? t("collapseAll") : t("expandAll")}
                      </button>
                    )}
                  </div>
                </th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("team")}</th>
                {isCourseView ? (
                  <>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("status")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("deadline")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3 w-40">{t("progressLabel")}</th>
                  </>
                ) : (
                  <>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("assigned")}</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("completed")}</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">En cours</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("overdue")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3 w-36">{t("progressLabel")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
              {groupByTeam
                ? buildGroups(filtered).flatMap(({ teamId, teamName, users: gUsers }) => [
                    <tr key={`g-${teamId ?? "none"}`} className="bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                      <td colSpan={colSpanCourse} className="px-5 py-2">
                        <span className="text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">
                          {teamName}
                          <span className="ml-2 font-normal normal-case">({gUsers.length})</span>
                        </span>
                      </td>
                    </tr>,
                    ...gUsers.map((u) => (
                      <UserRow
                        key={u.id} user={u}
                        courseId={filterCourse !== "all" ? filterCourse : null}
                        expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                        statusLabel={STATUS_LABEL} statusStyle={STATUS_STYLE} statusIcon={STATUS_ICON}
                      />
                    )),
                  ])
                : filtered.map((u) => (
                    <UserRow
                      key={u.id} user={u}
                      courseId={filterCourse !== "all" ? filterCourse : null}
                      expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                      statusLabel={STATUS_LABEL} statusStyle={STATUS_STYLE} statusIcon={STATUS_ICON}
                    />
                  ))}
            </tbody>
          </table>
        </div>

      ) : (
        /* ── Documents table ────────────────────────────────────────────── */
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span>{t("learner")}</span>
                    {!isDocView && (
                      <button
                        onClick={handleExpandAll}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors"
                      >
                        <ChevronRight className={cn("w-3 h-3 transition-transform", allExpanded && "rotate-90")} />
                        {allExpanded ? t("collapseAll") : t("expandAll")}
                      </button>
                    )}
                  </div>
                </th>
                <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("team")}</th>
                {isDocView ? (
                  <>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("status")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("deadline")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Signé le</th>
                  </>
                ) : (
                  <>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("assigned")}</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">Signés</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">En cours</th>
                    <th className="text-center text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3">{t("overdue")}</th>
                    <th className="text-left text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-5 py-3 w-36">Signature</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
              {groupByTeam
                ? buildGroups(filtered).flatMap(({ teamId, teamName, users: gUsers }) => [
                    <tr key={`g-${teamId ?? "none"}`} className="bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                      <td colSpan={colSpanDoc} className="px-5 py-2">
                        <span className="text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">
                          {teamName}
                          <span className="ml-2 font-normal normal-case">({gUsers.length})</span>
                        </span>
                      </td>
                    </tr>,
                    ...gUsers.map((u) => (
                      <UserDocRow
                        key={u.id} user={u}
                        docId={filterDoc !== "all" ? filterDoc : null}
                        expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                        statusLabel={DOC_LABEL} statusStyle={DOC_STYLE} statusIcon={DOC_ICON}
                      />
                    )),
                  ])
                : filtered.map((u) => (
                    <UserDocRow
                      key={u.id} user={u}
                      docId={filterDoc !== "all" ? filterDoc : null}
                      expanded={expandedUsers.has(u.id)} onToggle={() => toggleExpand(u.id)}
                      statusLabel={DOC_LABEL} statusStyle={DOC_STYLE} statusIcon={DOC_ICON}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── UserRow (courses) ───────────────────────────────────────────────────────

function UserRow({ user, courseId, expanded, onToggle, statusLabel, statusStyle, statusIcon }: {
  user:        UserProgressRow;
  courseId:    string | null;
  expanded:    boolean;
  onToggle:    () => void;
  statusLabel: Record<CourseStatus, string>;
  statusStyle: Record<CourseStatus, string>;
  statusIcon:  Record<CourseStatus, React.FC<{ className?: string }>>;
}) {
  const isCourseView = courseId !== null;
  const assignment   = isCourseView ? user.assignments.find((a) => a.courseId === courseId) : null;

  const completed  = user.assignments.filter((a) => a.status === "completed").length;
  const inProgress = user.assignments.filter((a) => a.status === "in_progress").length;
  const overdue    = user.assignments.filter(
    (a) => a.status !== "completed" && getDeadlineState(a.dueDate, a.assignedAt) === "overdue"
  ).length;
  const total     = user.assignments.length;
  const globalPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <tr
        className={cn(
          "transition-colors",
          !isCourseView ? "cursor-pointer hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]" : "hover:bg-[#F9F9FB] dark:hover:bg-[#2C2C2E]",
          expanded && !isCourseView && "bg-[#F5F5F7] dark:bg-[#2C2C2E]"
        )}
        onClick={!isCourseView ? onToggle : undefined}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {!isCourseView && (
              <ChevronRight className={cn("w-4 h-4 text-[#ADADB8] shrink-0 transition-transform", expanded && "rotate-90")} />
            )}
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                {user.name ?? <span className="italic text-[#ADADB8]">Sans nom</span>}
              </p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{user.email}</p>
            </div>
          </div>
        </td>
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
            <td className="px-5 py-3.5">
              {assignment ? (
                <StatusBadge
                  label={statusLabel[assignment.status]}
                  badgeClass={statusStyle[assignment.status]}
                  Icon={statusIcon[assignment.status]}
                />
              ) : (
                <span className="text-[12px] text-[#ADADB8] italic">Non assigné</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {assignment ? (
                <DeadlineBadge dueDate={assignment.dueDate} assignedAt={assignment.assignedAt} completed={assignment.status === "completed"} />
              ) : (
                <span className="text-[12px] text-[#ADADB8]">—</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {assignment ? <ProgressBar pct={assignment.progress} /> : <span className="text-[12px] text-[#ADADB8]">—</span>}
            </td>
          </>
        ) : (
          <>
            <td className="px-5 py-3.5 text-center">
              <span className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{total}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              <span className={cn("text-[14px] font-medium", completed > 0 ? "text-emerald-600" : "text-[#ADADB8]")}>{completed}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              <span className={cn("text-[14px] font-medium", inProgress > 0 ? "text-amber-500" : "text-[#ADADB8]")}>{inProgress}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              {overdue > 0 ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />{overdue}
                </span>
              ) : (
                <span className="text-[14px] text-[#ADADB8]">—</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {total > 0 ? <ProgressBar pct={globalPct} /> : <span className="text-[12px] text-[#ADADB8] italic">Aucun cours</span>}
            </td>
          </>
        )}
      </tr>

      {/* Accordion sub-rows */}
      {!isCourseView && expanded && user.assignments.map((a) => (
        <tr key={`${user.id}-${a.courseId}`} className="bg-[#FAFAFA] dark:bg-[#2C2C2E] border-t border-[#F0F0F5] dark:border-[#3A3A3C]">
          <td className="pl-12 pr-5 py-2.5" colSpan={2}>
            <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{a.courseTitle}</p>
          </td>
          <td className="px-5 py-2.5">
            <StatusBadge label={statusLabel[a.status]} badgeClass={statusStyle[a.status]} Icon={statusIcon[a.status]} />
          </td>
          <td className="px-5 py-2.5" colSpan={2}>
            <DeadlineEditor courseId={a.courseId} userId={user.id} dueDate={a.dueDate} assignedAt={a.assignedAt} completed={a.status === "completed"} />
          </td>
          <td className="px-5 py-2.5" colSpan={2}>
            <ProgressBar pct={a.progress} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ── UserDocRow (documents) ──────────────────────────────────────────────────

function UserDocRow({ user, docId, expanded, onToggle, statusLabel, statusStyle, statusIcon }: {
  user:        UserProgressRow;
  docId:       string | null;
  expanded:    boolean;
  onToggle:    () => void;
  statusLabel: Record<DocStatus, string>;
  statusStyle: Record<DocStatus, string>;
  statusIcon:  Record<DocStatus, React.FC<{ className?: string }>>;
}) {
  const isDocView    = docId !== null;
  const docAssignment = isDocView ? user.docAssignments.find((d) => d.docId === docId) : null;

  const signed     = user.docAssignments.filter((d) => d.status === "signed").length;
  const inProgress = user.docAssignments.filter((d) => d.status === "in_progress").length;
  const overdue    = user.docAssignments.filter(
    (d) => d.status !== "signed" && getDeadlineState(d.dueDate, d.assignedAt) === "overdue"
  ).length;
  const total      = user.docAssignments.length;
  const signedPct  = total > 0 ? Math.round((signed / total) * 100) : 0;

  return (
    <>
      <tr
        className={cn(
          "transition-colors",
          !isDocView ? "cursor-pointer hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]" : "hover:bg-[#F9F9FB] dark:hover:bg-[#2C2C2E]",
          expanded && !isDocView && "bg-[#F5F5F7] dark:bg-[#2C2C2E]"
        )}
        onClick={!isDocView ? onToggle : undefined}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {!isDocView && (
              <ChevronRight className={cn("w-4 h-4 text-[#ADADB8] shrink-0 transition-transform", expanded && "rotate-90")} />
            )}
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                {user.name ?? <span className="italic text-[#ADADB8]">Sans nom</span>}
              </p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{user.email}</p>
            </div>
          </div>
        </td>
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
        {isDocView ? (
          <>
            <td className="px-5 py-3.5">
              {docAssignment ? (
                <StatusBadge
                  label={statusLabel[docAssignment.status]}
                  badgeClass={statusStyle[docAssignment.status]}
                  Icon={statusIcon[docAssignment.status]}
                />
              ) : (
                <span className="text-[12px] text-[#ADADB8] italic">Non assigné</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {docAssignment ? (
                <DeadlineBadge dueDate={docAssignment.dueDate} assignedAt={docAssignment.assignedAt} completed={docAssignment.status === "signed"} />
              ) : (
                <span className="text-[12px] text-[#ADADB8]">—</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {docAssignment?.signedAt ? (
                <span className="text-[12px] text-emerald-600 font-medium">
                  {new Date(docAssignment.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) : (
                <span className="text-[12px] text-[#ADADB8]">—</span>
              )}
            </td>
          </>
        ) : (
          <>
            <td className="px-5 py-3.5 text-center">
              <span className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{total}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              <span className={cn("text-[14px] font-medium", signed > 0 ? "text-emerald-600" : "text-[#ADADB8]")}>{signed}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              <span className={cn("text-[14px] font-medium", inProgress > 0 ? "text-amber-500" : "text-[#ADADB8]")}>{inProgress}</span>
            </td>
            <td className="px-5 py-3.5 text-center">
              {overdue > 0 ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />{overdue}
                </span>
              ) : (
                <span className="text-[14px] text-[#ADADB8]">—</span>
              )}
            </td>
            <td className="px-5 py-3.5">
              {total > 0 ? <ProgressBar pct={signedPct} /> : <span className="text-[12px] text-[#ADADB8] italic">Aucun document</span>}
            </td>
          </>
        )}
      </tr>

      {/* Accordion sub-rows */}
      {!isDocView && expanded && user.docAssignments.map((d) => (
        <tr key={`${user.id}-${d.docId}`} className="bg-[#FAFAFA] dark:bg-[#2C2C2E] border-t border-[#F0F0F5] dark:border-[#3A3A3C]">
          <td className="pl-12 pr-5 py-2.5" colSpan={2}>
            <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{d.docTitle}</p>
          </td>
          <td className="px-5 py-2.5">
            <StatusBadge label={statusLabel[d.status]} badgeClass={statusStyle[d.status]} Icon={statusIcon[d.status]} />
          </td>
          <td className="px-5 py-2.5" colSpan={2}>
            <DeadlineEditor courseId={d.docId} userId={user.id} dueDate={d.dueDate} assignedAt={d.assignedAt} completed={d.status === "signed"} />
          </td>
          <td className="px-5 py-2.5" colSpan={2}>
            {d.signedAt ? (
              <span className="text-[12px] text-emerald-600 font-medium">
                Signé le {new Date(d.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            ) : (
              <span className="text-[12px] text-[#ADADB8]">—</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Shared UI helpers ────────────────────────────────────────────────────────

function StatusBadge({ label, badgeClass, Icon }: {
  label:      string;
  badgeClass: string;
  Icon:       React.FC<{ className?: string }>;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg", badgeClass)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function DeadlineBadge({ dueDate, assignedAt, completed }: { dueDate: string | null; assignedAt: string | null; completed: boolean }) {
  if (!dueDate || completed) return <span className="text-[12px] text-[#ADADB8]">—</span>;
  const state = getDeadlineState(dueDate, assignedAt);
  const date  = new Date(dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const styles: Record<NonNullable<DeadlineState>, string> = {
    overdue: "text-red-600 bg-red-50 dark:bg-red-500/10",
    danger:  "text-orange-600 bg-orange-50 dark:bg-orange-500/10",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    normal:  "text-[#6E6E73] dark:text-[#8E8E93] bg-[#F5F5F7] dark:bg-[#2C2C2E]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg", styles[state ?? "normal"])}>
      {state === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
      {state === "overdue" ? `En retard · ${date}` : date}
    </span>
  );
}

function DeadlineEditor({ courseId, userId, dueDate, assignedAt, completed }: {
  courseId:   string;
  userId:     string;
  dueDate:    string | null;
  assignedAt: string | null;
  completed:  boolean;
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
    overdue: "border-red-300 bg-red-50 dark:bg-red-500/10 text-red-600",
    danger:  "border-orange-300 bg-orange-50 dark:bg-orange-500/10 text-orange-600",
    warning: "border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-600",
    normal:  "border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7]",
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
      <div className="flex-1 h-1.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-400" : "bg-[#0071E3]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] w-8 text-right">{pct}%</span>
    </div>
  );
}
