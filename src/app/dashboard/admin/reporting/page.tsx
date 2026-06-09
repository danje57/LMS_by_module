"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Users, BookOpen, Trophy, Award, TrendingUp, BarChart2, Download, FileText, ClipboardList, X, ArrowUpRight, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DrillRow } from "@/app/api/admin/reporting/drilldown/route";

type Kpis = {
  totalCourses: number;
  totalUsers: number;
  totalCertificates: number;
  totalCompletions: number;
  activeThisWeek: number;
};

type CourseStat = {
  id: string;
  title: string;
  courseType: string;
  hasQuiz: boolean;
  enrolled: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
  avgScore: number | null;
  quizAttempts: number;
  quizPassed: number;
};

type TeamStat = {
  id: string;
  name: string;
  members: number;
  completions: number;
  avgCompletions: number;
};

type ActivityPoint = { date: string; label: string; count: number };

type GrcKpis = {
  totalDocuments: number;
  totalSignatures: number;
  globalSignatureRate: number;
  fullySignedDocs: number;
};

type DocumentStat = {
  id: string;
  title: string;
  department: string | null;
  assigned: number;
  signed: number;
  signatureRate: number;
};

type ReportingData = {
  kpis: Kpis;
  courseStats: CourseStat[];
  teamStats: TeamStat[];
  activityChart: ActivityPoint[];
  grcKpis: GrcKpis;
  documentStats: DocumentStat[];
};

type DrillDownType = "courses" | "users" | "completions" | "certificates" | "active_week"
  | "documents" | "signatures" | "unsigned" | "fully_signed";

const COURSE_TYPE_LABELS: Record<string, string> = {
  h5p: "H5P",
  native_video: "Vidéo",
  pptx: "PPTX",
};

// ── Drill-down panel ──────────────────────────────────────────────────────────

function DrillDownPanel({ type, title, onClose }: { type: DrillDownType; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<DrillRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setRows(null);
    fetch(`/api/admin/reporting/drilldown?type=${type}`)
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className="w-full max-w-md bg-white dark:bg-[#1C1C1E] h-full shadow-2xl flex flex-col border-l border-[#E5E5EA] dark:border-[#3A3A3C]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5EA] dark:border-[#3A3A3C] shrink-0">
          <h2 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
            <X className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#ADADB8]">
              <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mr-2" />
              Chargement…
            </div>
          ) : !rows?.length ? (
            <p className="text-center text-[14px] text-[#6E6E73] dark:text-[#8E8E93] py-16">Aucune donnée</p>
          ) : (
            <div className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F9F9F9] dark:hover:bg-[#2C2C2E] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{row.label}</p>
                    {row.sub && <p className="text-[11px] text-[#ADADB8] truncate">{row.sub}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.badge && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F0F0F5] dark:bg-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93]">
                        {row.badge}
                      </span>
                    )}
                    {row.value && (
                      <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] whitespace-nowrap">
                        {row.value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F5F5F7] dark:border-[#2C2C2E] shrink-0">
            <p className="text-[11px] text-[#ADADB8]">{rows.length} entrée{rows.length > 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nav sections ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "section-kpi-cours",   label: "Formations" },
  { id: "section-activite",    label: "Activité" },
  { id: "section-completion",  label: "Complétion" },
  { id: "section-quiz",        label: "Quiz" },
  { id: "section-equipes",     label: "Équipes" },
  { id: "section-cours",       label: "Détail cours" },
  { id: "section-grc",         label: "Documents GRC" },
  { id: "section-exports",     label: "Exports" },
] as const;

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, onClick, active, href }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  onClick?: () => void;
  active?: boolean;
  href?: string;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "bg-white dark:bg-[#1C1C1E] rounded-2xl border p-5 flex items-center gap-4 w-full text-left transition-all",
          onClick ? "cursor-pointer hover:shadow-md hover:border-[#0071E3]/40" : "cursor-default",
          active ? "border-[#0071E3] ring-2 ring-[#0071E3]/20" : "border-[#E5E5EA] dark:border-[#3A3A3C]",
        )}
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[24px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none">{value}</p>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{label}</p>
          {sub && <p className="text-[11px] text-[#ADADB8] mt-0.5">{sub}</p>}
        </div>
      </button>
      {href && (
        <Link
          href={href}
          className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100
            text-[#ADADB8] hover:text-[#0071E3] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]
            transition-all"
          title="Ouvrir la page"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{children}</h2>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[13px] font-semibold" style={{ color: p.color }}>
          {p.value}{p.unit ?? ""}
        </p>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const DRILL_CONFIG: Record<DrillDownType, string> = {
  courses:      "Cours actifs",
  users:        "Apprenants actifs",
  completions:  "Complétions totales",
  certificates: "Certificats émis",
  active_week:  "Actifs cette semaine",
  documents:    "Documents GRC",
  signatures:   "Signatures GRC",
  unsigned:     "En attente de signature",
  fully_signed: "Documents 100% signés",
};

export default function ReportingPage() {
  const [data, setData] = useState<ReportingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDrill, setActiveDrill] = useState<DrillDownType | null>(null);
  const [activeSection, setActiveSection] = useState<string>("section-kpi-cours");

  const loadData = useCallback(() => {
    setRefreshing(true);
    fetch("/api/admin/reporting")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); setRefreshing(false); })
      .catch(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-15% 0% -75% 0%", threshold: 0 },
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [data]);

  function toggleDrill(type: DrillDownType) {
    setActiveDrill((prev) => prev === type ? null : type);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#ADADB8]">
        <BarChart2 className="w-5 h-5 animate-pulse mr-2" />
        Chargement du rapport…
      </div>
    );
  }
  if (!data) return <p className="text-red-500">Erreur de chargement.</p>;

  const { kpis, courseStats, teamStats, activityChart, grcKpis, documentStats } = data;

  const completionChartData = courseStats
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10)
    .map((c) => ({ name: c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title, taux: c.completionRate, inscrits: c.enrolled }));

  const quizChartData = courseStats
    .filter((c) => c.hasQuiz && c.avgScore !== null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .map((c) => ({ name: c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title, score: c.avgScore }));

  return (
    <>
      <div className="max-w-6xl mx-auto flex gap-8 items-start">

        {/* ── Vertical nav sidebar ── */}
        <aside className="hidden xl:block sticky top-8 w-36 shrink-0 pt-8">
          <nav className="space-y-0.5">
            {NAV_SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                  activeSection === id
                    ? "text-[#0071E3] bg-blue-50 dark:bg-blue-500/10"
                    : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]",
                )}
              >
                {activeSection === id && (
                  <span className="w-1 h-1 rounded-full bg-[#0071E3] shrink-0" />
                )}
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Tableau de bord reporting
            </h1>
            <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
              Vue globale des completions, scores et activité de la plateforme · Cliquez un KPI pour le détail
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] text-[13px] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors disabled:opacity-50 shrink-0 mt-1"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Rafraîchir
          </button>
        </div>

        {/* KPI grid */}
        <div id="section-kpi-cours" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 scroll-mt-8">
          <KpiCard icon={BookOpen}   label="Cours actifs"         value={kpis.totalCourses}     color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"       onClick={() => toggleDrill("courses")}      active={activeDrill === "courses"}      href="/dashboard/courses" />
          <KpiCard icon={Users}      label="Apprenants actifs"    value={kpis.totalUsers}        color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" onClick={() => toggleDrill("users")}         active={activeDrill === "users"}         href="/dashboard/admin/users" />
          <KpiCard icon={Trophy}     label="Complétions totales"  value={kpis.totalCompletions}  color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"     onClick={() => toggleDrill("completions")}  active={activeDrill === "completions"}   href="/dashboard/admin/progress" />
          <KpiCard icon={Award}      label="Certificats émis"     value={kpis.totalCertificates} color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"  onClick={() => toggleDrill("certificates")} active={activeDrill === "certificates"}  href="/dashboard/admin/certificates" />
          <KpiCard icon={TrendingUp} label="Actifs cette semaine" value={kpis.activeThisWeek}    color="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"             onClick={() => toggleDrill("active_week")}  active={activeDrill === "active_week"}   href="/dashboard/admin/activity" />
        </div>

        {/* Activity line chart */}
        <div id="section-activite" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4 scroll-mt-8">
          <SectionTitle>Activité quotidienne — 30 derniers jours</SectionTitle>
          <p className="text-[12px] text-[#8E8E93]">Cours démarrés + terminés + quiz soumis</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={activityChart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="#0071E3" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#0071E3" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion rate per course */}
        {completionChartData.length > 0 && (
          <div id="section-completion" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4 scroll-mt-8">
            <SectionTitle>Taux de complétion par cours</SectionTitle>
            <p className="text-[12px] text-[#8E8E93]">Top 10 des cours avec apprenants inscrits</p>
            <ResponsiveContainer width="100%" height={Math.max(180, completionChartData.length * 36)}>
              <BarChart data={completionChartData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="taux" name="Complétion" unit="%" fill="#34C759" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Quiz scores */}
        {quizChartData.length > 0 && (
          <div id="section-quiz" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4 scroll-mt-8">
            <SectionTitle>Score moyen aux quiz</SectionTitle>
            <p className="text-[12px] text-[#8E8E93]">Moyenne de tous les passages pour les cours avec quiz</p>
            <ResponsiveContainer width="100%" height={Math.max(180, quizChartData.length * 36)}>
              <BarChart data={quizChartData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Score moyen" unit="%" fill="#FF9500" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-team table */}
        {teamStats.length > 0 && (
          <div id="section-equipes" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden scroll-mt-8">
            <div className="px-6 py-4 border-b border-[#F0F0F5] dark:border-[#3A3A3C]">
              <SectionTitle>Complétion par équipe</SectionTitle>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0F0F5] dark:border-[#2C2C2E] bg-[#F9F9F9] dark:bg-[#2C2C2E]">
                  {["Équipe", "Membres", "Complétions totales", "Moy. / membre", "Progression"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                {teamStats.map((t) => {
                  const maxCompletions = Math.max(...teamStats.map((x) => x.completions), 1);
                  const pct = Math.round((t.completions / maxCompletions) * 100);
                  return (
                    <tr key={t.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-3 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t.name}</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t.members}</td>
                      <td className="px-5 py-3 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7]">{t.completions}</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{t.avgCompletions}</td>
                      <td className="px-5 py-3 w-40">
                        <div className="h-2 bg-[#F0F0F5] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
                          <div className="h-full bg-[#0071E3] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Per-course detail table */}
        {courseStats.length > 0 && (
          <div id="section-cours" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden scroll-mt-8">
            <div className="px-6 py-4 border-b border-[#F0F0F5] dark:border-[#3A3A3C]">
              <SectionTitle>Détail par cours</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F5] dark:border-[#2C2C2E] bg-[#F9F9F9] dark:bg-[#2C2C2E]">
                    {["Cours", "Type", "Inscrits", "Complétions", "Taux", "Progression moy.", "Score moy."].map((h) => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                  {courseStats.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-3 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] max-w-[200px] truncate">{c.title}</td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#8E8E93] bg-[#F0F0F5] dark:bg-[#3A3A3C] px-2 py-0.5 rounded-lg">
                          {COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{c.enrolled}</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{c.completed}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#F0F0F5] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", c.completionRate >= 70 ? "bg-emerald-500" : c.completionRate >= 40 ? "bg-amber-500" : "bg-red-400")}
                              style={{ width: `${c.completionRate}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{c.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{c.avgProgress}%</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
                        {c.avgScore !== null ? `${c.avgScore}%` : <span className="text-[#ADADB8]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── GRC Section ── */}
        <div id="section-grc" className="scroll-mt-8">
          <h2 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Documents GRC</h2>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">Politiques, chartes et procédures — suivi des attestations de lecture</p>
        </div>

        {/* GRC KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={FileText}   label="Documents actifs"        value={grcKpis.totalDocuments}              color="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"     onClick={() => toggleDrill("documents")}  active={activeDrill === "documents"}  href="/dashboard/documents" />
          <KpiCard icon={Award}      label="Signatures totales"       value={grcKpis.totalSignatures}             color="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400"             onClick={() => toggleDrill("signatures")} active={activeDrill === "signatures"} href="/dashboard/admin/activity" />
          <KpiCard icon={TrendingUp} label="Taux global de signature" value={`${grcKpis.globalSignatureRate}%`}  color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <KpiCard icon={Trophy}     label="Docs conformes"            value={grcKpis.fullySignedDocs}             color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"         onClick={() => toggleDrill("fully_signed")}  active={activeDrill === "fully_signed"}   href="/dashboard/documents"
            sub={grcKpis.totalDocuments > 0 ? `sur ${grcKpis.totalDocuments}` : undefined} />
        </div>

        {/* GRC bar chart */}
        {documentStats.filter((d) => d.assigned > 0).length > 0 && (() => {
          const chartData = documentStats
            .filter((d) => d.assigned > 0)
            .sort((a, b) => b.signatureRate - a.signatureRate)
            .map((d) => ({
              name: d.title.length > 24 ? d.title.slice(0, 24) + "…" : d.title,
              taux: d.signatureRate,
              assignes: d.assigned,
            }));
          return (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
              <SectionTitle>Taux de signature par document</SectionTitle>
              <p className="text-[12px] text-[#8E8E93]">Documents avec au moins un apprenant assigné</p>
              <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} width={160} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="taux" name="Signatures" unit="%" fill="#0071E3" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* GRC per-document table */}
        {documentStats.length > 0 && (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0F0F5] dark:border-[#3A3A3C] flex items-center justify-between">
              <SectionTitle>Détail par document</SectionTitle>
              <button
                type="button"
                onClick={() => toggleDrill("unsigned")}
                className={cn(
                  "text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors",
                  activeDrill === "unsigned"
                    ? "bg-[#0071E3] text-white"
                    : "text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]",
                )}
              >
                Voir les en attente
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F5] dark:border-[#2C2C2E] bg-[#F9F9F9] dark:bg-[#2C2C2E]">
                    {["Document", "Département", "Assignés", "Signés", "Taux"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                  {documentStats.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-3 text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] max-w-[220px] truncate">{d.title}</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
                        {d.department
                          ? <span className="text-[11px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg">{d.department}</span>
                          : <span className="text-[#ADADB8]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{d.assigned}</td>
                      <td className="px-5 py-3 text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">{d.signed}</td>
                      <td className="px-5 py-3">
                        {d.assigned > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#F0F0F5] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", d.signatureRate === 100 ? "bg-emerald-500" : d.signatureRate >= 50 ? "bg-amber-500" : "bg-red-400")}
                                style={{ width: `${d.signatureRate}%` }}
                              />
                            </div>
                            <span className="text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{d.signatureRate}%</span>
                          </div>
                        ) : <span className="text-[#ADADB8] text-[12px]">Non assigné</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exports CSV */}
        <div id="section-exports" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4 scroll-mt-8">
          <div>
            <SectionTitle>Exports CSV</SectionTitle>
            <p className="text-[12px] text-[#8E8E93] mt-1">Fichiers téléchargeables pour reporting RH et conformité</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="/api/admin/export?type=progress" download
              className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Progressions</p>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Avancement par cours, statut, dates</p>
              </div>
              <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
            </a>
            <a href="/api/admin/export?type=quiz" download
              className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Résultats quiz</p>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Scores, seuils, réussite/échec par tentative</p>
              </div>
              <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
            </a>
            <a href="/api/admin/export?type=documents" download
              className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Signatures GRC</p>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Statut signature par document et par apprenant</p>
              </div>
              <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
            </a>
          </div>
        </div>

        </div>{/* end main content */}
      </div>{/* end flex row */}

      {/* Drill-down panel */}
      {activeDrill && (
        <DrillDownPanel
          type={activeDrill}
          title={DRILL_CONFIG[activeDrill]}
          onClose={() => setActiveDrill(null)}
        />
      )}
    </>
  );
}
