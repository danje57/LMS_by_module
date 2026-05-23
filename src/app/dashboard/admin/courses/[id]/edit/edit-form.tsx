"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QuizEditor } from "@/components/courses/quiz-editor";
import { NativeVideoEditor } from "@/components/courses/native-video-editor";
import { ArrowLeft, Save, Users, CircleCheck, BarChart2, Award, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface CourseData {
  id: string;
  title: string;
  category: string | null;
  duration: number;
  passingScore: number | null;
  hasQuiz: boolean;
  courseType: string;
  createdById: string | null;
}

interface NativeVideoData {
  id: string;
  videoPath: string;
  duration: number | null;
  questions: { id: string; timestamp: number; question: string; choices: { id: string; text: string; correct: boolean }[]; order: number }[];
}

interface Creator { id: string; name: string | null; email: string }

const inputCls = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
const labelCls = "block text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] mb-1";

type CourseStats = {
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  avgQuizScore: number | null;
  quizAttempts: number;
  certCount: number;
};

export function EditCourseForm({ isAdmin }: { isAdmin: boolean }) {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("courseStats");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState(0);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [passingScore, setPassingScore] = useState(80);
  const [createdById, setCreatedById] = useState<string>("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [nativeVideo, setNativeVideo] = useState<NativeVideoData | null>(null);

  useEffect(() => {
    fetch(`/api/admin/courses/${id}`)
      .then((r) => r.json())
      .then((data: CourseData) => {
        setCourse(data);
        setTitle(data.title);
        setCategory(data.category ?? "");
        setDuration(data.duration);
        setHasQuiz(data.hasQuiz);
        setPassingScore(data.passingScore ?? 80);
        setCreatedById(data.createdById ?? "");
        if (data.courseType === "native_video") {
          fetch(`/api/courses/${id}/native-video`)
            .then(r => r.json())
            .then(d => setNativeVideo(d));
        }
      });

    if (isAdmin) {
      fetch("/api/admin/users/creators")
        .then((r) => r.json())
        .then((data: Creator[]) => setCreators(data));
    }

    fetch(`/api/admin/courses/${id}/stats`)
      .then((r) => r.json())
      .then((data: CourseStats) => setStats(data))
      .catch(() => {});
  }, [id, isAdmin]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration, hasQuiz, passingScore: hasQuiz ? passingScore : null, createdById }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const effectiveScore = questionCount > 0
    ? Math.round((Math.ceil((questionCount * passingScore) / 100) / questionCount) * 100)
    : null;
  const quizRatioOk = !hasQuiz || questionCount === 0 || effectiveScore === passingScore;

  if (!course) {
    return <div className="py-20 text-center text-[13px] text-[#6E6E73]">Chargement…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/courses"
          className="p-2 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#ADADB8] dark:text-[#636366] font-medium">Édition du cours</p>
          <h1 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{course.title}</h1>
        </div>
      </div>

      {/* Stats panel */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("assignedLearners"), value: stats.assignedCount, icon: Users, color: "text-[#0071E3]", bg: "bg-blue-50 dark:bg-[#0071E3]/10" },
            { label: t("completionRate"), value: `${stats.completionRate}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { label: t("avgQuizScore"), value: stats.avgQuizScore !== null ? `${stats.avgQuizScore}%` : "—", icon: BarChart2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
            { label: t("certificates"), value: stats.certCount, icon: Award, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", kpi.bg)}>
                <kpi.icon className={cn("w-4 h-4", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none">{kpi.value}</p>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5 leading-tight">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
        <div className="p-6 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Informations</h2>
          {isAdmin && (
            <div>
              <label className={labelCls}>Créateur du cours</label>
              <select value={createdById} onChange={(e) => setCreatedById(e.target.value)} className={inputCls}>
                <option value="">— Aucun —</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          {category && (
            <div>
              <label className={labelCls}>Département</label>
              <p className="text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] h-10 flex items-center px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                {category}
              </p>
            </div>
          )}
          <div>
            <label className={labelCls}>Durée (minutes)</label>
            <input type="number" min={1} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={hasQuiz} onChange={(e) => setHasQuiz(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0071E3]" />
            <span className="text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">Ce cours contient un quiz</span>
          </label>

          {hasQuiz && (
            <div className="max-w-[180px]">
              <label className={labelCls}>Score de passage (%)</label>
              <input type="number" min={0} max={100} value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))} className={inputCls} />
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            {!quizRatioOk && (
              <p className="text-[12px] text-amber-700">
                Corrigez le ratio questions / seuil avant d&apos;enregistrer.
              </p>
            )}
            <div className="ml-auto">
              <button onClick={handleSave} disabled={saving || !quizRatioOk}
                title={!quizRatioOk ? `Seuil effectif ${effectiveScore}% ≠ seuil configuré ${passingScore}%` : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  saved ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                )}>
                <Save className="w-3.5 h-3.5" />
                {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>

        {course.courseType === "native_video" && (
          <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Vidéo &amp; Questions</h2>
            <NativeVideoEditor
              courseId={id}
              initialVideoId={nativeVideo?.id}
              initialQuestions={nativeVideo?.questions ?? []}
              onSaved={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}
            />
          </div>
        )}

        {course.courseType !== "native_video" && (
          <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Questions du quiz</h2>
            <QuizEditor courseId={id} passingScore={passingScore} onCountChange={setQuestionCount} />
            <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F7] dark:border-[#3A3A3C] mt-4">
              {!quizRatioOk && (
                <p className="text-[12px] text-amber-700">
                  Corrigez le ratio questions / seuil avant d&apos;enregistrer.
                </p>
              )}
              <div className="ml-auto">
                <button onClick={handleSave} disabled={saving || !quizRatioOk}
                  title={!quizRatioOk ? `Seuil effectif ${effectiveScore}% ≠ seuil configuré ${passingScore}%` : undefined}
                  className={cn(
                    "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    saved ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                  )}>
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
