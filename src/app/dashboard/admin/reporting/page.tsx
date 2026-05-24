"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Users, BookOpen, Trophy, Award, TrendingUp, BarChart2, Download, FileText, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type ReportingData = {
  kpis: Kpis;
  courseStats: CourseStat[];
  teamStats: TeamStat[];
  activityChart: ActivityPoint[];
};

const COURSE_TYPE_LABELS: Record<string, string> = {
  h5p: "H5P",
  native_video: "Vidéo",
  pptx: "PPTX",
};

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-5 flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[24px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none">{value}</p>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-[#ADADB8] mt-0.5">{sub}</p>}
      </div>
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

export default function ReportingPage() {
  const [data, setData] = useState<ReportingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reporting")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#ADADB8]">
        <BarChart2 className="w-5 h-5 animate-pulse mr-2" />
        Chargement du rapport…
      </div>
    );
  }
  if (!data) return <p className="text-red-500">Erreur de chargement.</p>;

  const { kpis, courseStats, teamStats, activityChart } = data;

  const completionChartData = courseStats
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10)
    .map((c) => ({ name: c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title, taux: c.completionRate, inscrits: c.enrolled }));

  const quizChartData = courseStats
    .filter((c) => c.hasQuiz && c.avgScore !== null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .map((c) => ({ name: c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title, score: c.avgScore }));

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          Tableau de bord reporting
        </h1>
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          Vue globale des completions, scores et activité de la plateforme
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={BookOpen}  label="Cours actifs"         value={kpis.totalCourses}      color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" />
        <KpiCard icon={Users}     label="Apprenants actifs"    value={kpis.totalUsers}         color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
        <KpiCard icon={Trophy}    label="Complétions totales"  value={kpis.totalCompletions}   color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <KpiCard icon={Award}     label="Certificats émis"     value={kpis.totalCertificates}  color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" />
        <KpiCard icon={TrendingUp}label="Actifs cette semaine" value={kpis.activeThisWeek}     color="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" />
      </div>

      {/* Activity line chart */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
        <SectionTitle>Activité quotidienne — 30 derniers jours</SectionTitle>
        <p className="text-[12px] text-[#8E8E93]">Cours démarrés + terminés + quiz soumis</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={activityChart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#ADADB8" }}
              tickLine={false}
              interval={4}
            />
            <YAxis tick={{ fontSize: 10, fill: "#ADADB8" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#0071E3"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#0071E3" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Completion rate per course */}
      {completionChartData.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
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
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
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
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
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
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
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

      {/* Exports CSV */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-4">
        <div>
          <SectionTitle>Exports CSV</SectionTitle>
          <p className="text-[12px] text-[#8E8E93] mt-1">Fichiers téléchargeables pour reporting RH et conformité</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/api/admin/export?type=progress"
            download
            className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Progressions</p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Tous les apprenants — avancement par cours, statut, dates</p>
            </div>
            <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
          </a>

          <a
            href="/api/admin/export?type=quiz"
            download
            className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Résultats quiz</p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Scores, seuils, réussite/échec par tentative et par apprenant</p>
            </div>
            <Download className="w-4 h-4 text-[#ADADB8] group-hover:text-[#0071E3] transition-colors shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}
