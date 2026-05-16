"use client";

import { useState, useEffect } from "react";
import { H5PPlayer } from "@/components/courses/h5p-player";
import { QuizPlayer } from "@/components/courses/quiz-player";
import { ClipboardList, BookOpen, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  courseId: string;
  filePath: string;
  hasQuiz: boolean;
  passingScore: number;
}

type Tab = "course" | "quiz";

export function PlayPageClient({ courseId, filePath, hasQuiz, passingScore }: Props) {
  const [tab, setTab] = useState<Tab>("course");
  const [courseCompleted, setCourseCompleted] = useState(false);

  // Vérifier si le cours a déjà été complété (session précédente)
  useEffect(() => {
    if (!hasQuiz) return;
    fetch(`/api/courses/${courseId}/progress`)
      .then((r) => r.json())
      .then((d) => { if (d.completed) setCourseCompleted(true); });
  }, [courseId, hasQuiz]);

  // Écouter le postMessage de l'iframe H5P
  useEffect(() => {
    if (!hasQuiz) return;
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "h5p-completed") {
        setCourseCompleted(true);
        fetch(`/api/courses/${courseId}/progress`, { method: "POST" });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [courseId, hasQuiz]);

  if (!hasQuiz) {
    return <H5PPlayer courseId={courseId} filePath={filePath} />;
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#F5F5F7] rounded-xl p-1 w-fit">
        {/* Onglet Cours */}
        <button
          onClick={() => setTab("course")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all",
            tab === "course" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#6E6E73] hover:text-[#1D1D1F]"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Cours
        </button>

        {/* Onglet Quiz — verrouillé si cours non terminé */}
        <button
          onClick={() => courseCompleted && setTab("quiz")}
          title={courseCompleted ? undefined : "Terminez le cours pour accéder au quiz"}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all",
            !courseCompleted && "opacity-50 cursor-not-allowed",
            courseCompleted && tab === "quiz" && "bg-white text-[#1D1D1F] shadow-sm",
            courseCompleted && tab !== "quiz" && "text-[#6E6E73] hover:text-[#1D1D1F]"
          )}
        >
          {courseCompleted
            ? <ClipboardList className="w-3.5 h-3.5" />
            : <Lock className="w-3.5 h-3.5" />}
          Quiz
          {!courseCompleted && (
            <span className="text-[11px] text-[#ADADB8]">— finissez le cours</span>
          )}
        </button>
      </div>

      {tab === "course" && (
        <>
          <H5PPlayer courseId={courseId} filePath={filePath} />
          {courseCompleted && (
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <p className="text-[13px] text-green-700 font-medium">Cours terminé — le quiz est maintenant disponible.</p>
              <button
                onClick={() => setTab("quiz")}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Passer le quiz
              </button>
            </div>
          )}
        </>
      )}

      {tab === "quiz" && courseCompleted && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6">
          <QuizPlayer
            courseId={courseId}
            passingScore={passingScore}
            onClose={() => setTab("course")}
          />
        </div>
      )}
    </div>
  );
}
