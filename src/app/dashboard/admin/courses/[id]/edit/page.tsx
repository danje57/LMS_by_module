"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QuizEditor } from "@/components/courses/quiz-editor";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CourseData {
  id: string;
  title: string;
  duration: number;
  passingScore: number | null;
  hasQuiz: boolean;
}

const inputCls = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
const labelCls = "block text-[12px] font-medium text-[#6E6E73] mb-1";

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [passingScore, setPassingScore] = useState(80);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setTimeout(() => setSaved(false), 2500);
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

      {/* Informations + Quiz sur une seule carte */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F5F5F7]">

        {/* Bloc infos */}
        <div className="p-6 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#1D1D1F]">Informations</h2>
          <div>
            <label className={labelCls}>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Durée (minutes)</label>
              <input type="number" min={1} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Score de passage (%)</label>
              <input type="number" min={0} max={100} value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={handleSave} disabled={saving}
              className={cn(
                "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-60",
                saved ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
              )}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Bloc quiz */}
        <div className="p-6 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#1D1D1F]">Questions du quiz</h2>
          <QuizEditor courseId={id} />
        </div>

      </div>
    </div>
  );
}
