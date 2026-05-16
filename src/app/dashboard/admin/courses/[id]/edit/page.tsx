"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuizEditor } from "@/components/courses/quiz-editor";
import { ArrowLeft, Save, BookOpen, ClipboardList } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "infos" | "quiz";

interface CourseData {
  id: string;
  title: string;
  duration: number;
  passingScore: number | null;
  hasQuiz: boolean;
}

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("infos");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [passingScore, setPassingScore] = useState(80);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [savedQuiz, setSavedQuiz] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/courses/${id}`)
      .then((r) => r.json())
      .then((data: CourseData) => {
        setCourse(data);
        setTitle(data.title);
        setDuration(data.duration);
        setPassingScore(data.passingScore ?? 80);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration, passingScore }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveQuiz() {
    setSavingQuiz(true);
    await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passingScore }),
    });
    setSavingQuiz(false);
    setSavedQuiz(true);
    setTimeout(() => setSavedQuiz(false), 2000);
  }

  if (!course) {
    return <div className="py-20 text-center text-[13px] text-[#6E6E73]">Chargement…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/courses"
          className="p-2 rounded-xl border border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#ADADB8] font-medium">Édition du cours</p>
          <h1 className="text-[18px] font-semibold text-[#1D1D1F] truncate">{course.title}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5F5F7] rounded-xl p-1 w-fit">
        {([["infos", "Informations", BookOpen], ["quiz", "Quiz", ClipboardList]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all",
              tab === value
                ? "bg-white text-[#1D1D1F] shadow-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Informations */}
      {tab === "infos" && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-5">
          <div>
            <label className="block text-[12px] font-medium text-[#6E6E73] mb-1">Titre du cours</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#6E6E73] mb-1">Durée (minutes)</label>
              <input
                type="number" min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6E6E73] mb-1">Score de passage (%)</label>
              <input
                type="number" min={0} max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-60",
                saved
                  ? "bg-green-500 text-white"
                  : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Quiz */}
      {tab === "quiz" && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-5">
          {/* Score de passage + Enregistrer */}
          <div className="flex items-end gap-4 pb-5 border-b border-[#F5F5F7]">
            <div className="flex-1 max-w-[180px]">
              <label className="block text-[12px] font-medium text-[#6E6E73] mb-1">Score de passage (%)</label>
              <input
                type="number" min={0} max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
              />
            </div>
            <button
              onClick={handleSaveQuiz}
              disabled={savingQuiz}
              className={cn(
                "flex items-center gap-1.5 px-5 h-10 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-60",
                savedQuiz ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {savingQuiz ? "Enregistrement…" : savedQuiz ? "Enregistré !" : "Enregistrer"}
            </button>
          </div>
          <QuizEditor courseId={id} />
        </div>
      )}
    </div>
  );
}
