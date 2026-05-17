"use client";

import { useState, useEffect, useRef } from "react";
import { H5PPlayer } from "@/components/courses/h5p-player";
import { QuizPlayer } from "@/components/courses/quiz-player";
import { ClipboardList, BookOpen, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  courseId: string;
  courseTitle: string;
  filePath: string;
  hasQuiz: boolean;
  passingScore: number;
  userName: string;
  logoPath: string | null;
}

type Tab = "course" | "quiz";

export function PlayPageClient({ courseId, courseTitle, filePath, hasQuiz, passingScore, userName, logoPath }: Props) {
  const [tab, setTab] = useState<Tab>("course");
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [slideInfo, setSlideInfo] = useState<{ current: number; visited: number[]; total: number } | null>(null);
  const [savedVisited, setSavedVisited] = useState<number[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger la progression sauvegardée (slides visitées + complétion)
  useEffect(() => {
    fetch(`/api/courses/${courseId}/progress`)
      .then((r) => r.json())
      .then((d) => {
        if (d.completed) setCourseCompleted(true);
        if (Array.isArray(d.visitedSlides) && d.visitedSlides.length > 0) {
          setSavedVisited(d.visitedSlides);
        }
      });
  }, [courseId]);

  // Écouter le postMessage de l'iframe H5P
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "h5p-completed") {
        const visited: number[] = e.data.visited ?? [];
        setCourseCompleted(true);
        fetch(`/api/courses/${courseId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitedSlides: visited }),
        });
      }
      if (e.data?.type === "h5p-slide-update") {
        const { current, visited, total } = e.data;
        setSlideInfo({ current, visited, total });

        // Sauvegarde différée (debounce 2s) pour ne pas spammer la DB
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          fetch(`/api/courses/${courseId}/progress`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visitedSlides: visited }),
          });
        }, 2000);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [courseId]);

  return (
    <div className="space-y-4">
      {/* Tab switcher — uniquement si le cours a un quiz */}
      {hasQuiz && (
        <div className="flex gap-1 bg-[#F5F5F7] rounded-xl p-1 w-fit">
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
            {courseCompleted ? <ClipboardList className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            Quiz
            {!courseCompleted && <span className="text-[11px] text-[#ADADB8]">— finissez le cours</span>}
          </button>
        </div>
      )}

      {tab === "course" && (
        <>
          <H5PPlayer courseId={courseId} filePath={filePath} visitedSlides={savedVisited} />

          {/* Barre de progression des slides */}
          {slideInfo && slideInfo.total > 0 && (
            <div className="bg-white border border-[#E5E5EA] rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-[#6E6E73]">Progression des slides</p>
                <p className="text-[12px] text-[#ADADB8]">
                  {slideInfo.visited.length} / {slideInfo.total} vues
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: slideInfo.total }, (_, i) => {
                  const isVisited = slideInfo.visited.includes(i);
                  const isCurrent = slideInfo.current === i;
                  return (
                    <div
                      key={i}
                      title={`Slide ${i + 1}${isVisited ? " — vue" : " — non vue"}`}
                      className={cn(
                        "w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all",
                        isCurrent ? "bg-[#0071E3] text-white scale-110 shadow-sm" :
                        isVisited ? "bg-green-500 text-white" :
                                    "bg-[#E5E5EA] text-[#ADADB8]"
                      )}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Banner de complétion */}
          {courseCompleted && (
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              {hasQuiz ? (
                <>
                  <p className="text-[13px] text-green-700 font-medium">Cours terminé — le quiz est maintenant disponible.</p>
                  <button
                    onClick={() => setTab("quiz")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Passer le quiz
                  </button>
                </>
              ) : (
                <p className="text-[13px] text-green-700 font-medium">✓ Cours terminé — toutes les slides ont été consultées.</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === "quiz" && courseCompleted && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6">
          <QuizPlayer
            courseId={courseId}
            courseTitle={courseTitle}
            passingScore={passingScore}
            userName={userName}
            logoPath={logoPath}
            onClose={() => setTab("course")}
          />
        </div>
      )}
    </div>
  );
}
