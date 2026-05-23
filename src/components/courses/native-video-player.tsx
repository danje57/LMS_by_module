"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { CheckCircle, XCircle } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

type QuestionType = "qcm" | "vrai_faux";

interface Choice { id: string; text: string; correct: boolean; }
interface Question {
  id: string;
  timestamp: number;
  question: string;
  choices: Choice[];
  order: number;
  type?: QuestionType;
  allowMultiple?: boolean;
  explanation?: string | null;
}
interface NativeVideoData { id: string; videoPath: string; duration: number | null; questions: Question[]; }

interface Props {
  courseId: string;
  videoData: NativeVideoData;
  onComplete: () => void;
}

export function NativeVideoPlayer({ courseId, videoData, onComplete }: Props) {
  const t = useTranslations("nativeVideo");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [completed, setCompleted] = useState(false);
  const triggeredRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);

  const allAnswered = videoData.questions.every(q => answered[q.id]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || activeQuestion) return;

    const currentTime = video.currentTime;

    if (!startedRef.current && currentTime > 0) {
      startedRef.current = true;
      void fetch(`/api/courses/${courseId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitedSlides: [] }),
      });
    }

    for (const q of videoData.questions) {
      if (!triggeredRef.current.has(q.id) && Math.abs(currentTime - q.timestamp) < 0.5) {
        video.pause();
        triggeredRef.current.add(q.id);
        setActiveQuestion(q);
        setSelectedChoices(new Set());
        setFeedback(null);
        break;
      }
    }
  }, [activeQuestion, courseId, videoData.questions]);

  const handleEnded = useCallback(() => {
    if (allAnswered && !completed) {
      setCompleted(true);
      onComplete();
    }
  }, [allAnswered, completed, onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [handleTimeUpdate, handleEnded]);

  function toggleChoice(choiceId: string) {
    if (feedback !== null || !activeQuestion) return;
    if (activeQuestion.allowMultiple) {
      setSelectedChoices(prev => {
        const next = new Set(prev);
        if (next.has(choiceId)) next.delete(choiceId);
        else next.add(choiceId);
        return next;
      });
    } else {
      setSelectedChoices(new Set([choiceId]));
    }
  }

  function submitAnswer() {
    if (!activeQuestion || selectedChoices.size === 0) return;

    const correctIds = new Set(activeQuestion.choices.filter(c => c.correct).map(c => c.id));
    let isCorrect: boolean;

    if (activeQuestion.allowMultiple) {
      isCorrect = selectedChoices.size === correctIds.size &&
        [...selectedChoices].every(id => correctIds.has(id));
    } else {
      isCorrect = correctIds.has([...selectedChoices][0]);
    }

    setFeedback(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setAnswered(prev => ({ ...prev, [activeQuestion.id]: true }));
      setTimeout(() => {
        setActiveQuestion(null);
        setFeedback(null);
        setSelectedChoices(new Set());
        videoRef.current?.play();
      }, activeQuestion.explanation ? 2500 : 1200);
    }
  }

  function retryQuestion() {
    setSelectedChoices(new Set());
    setFeedback(null);
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        src={`/api/native-video/${videoData.id}/stream`}
        className="w-full h-full"
        controls={!activeQuestion}
        controlsList="nodownload"
        preload="metadata"
      />

      {activeQuestion && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            {/* Badge type */}
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md",
                (activeQuestion.type ?? "qcm") === "qcm"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-purple-50 text-purple-600")}>
                {(activeQuestion.type ?? "qcm") === "qcm"
                  ? (activeQuestion.allowMultiple ? "Plusieurs réponses possibles" : "Une seule bonne réponse")
                  : "Vrai ou Faux"}
              </span>
            </div>

            <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{activeQuestion.question}</p>

            <div className="space-y-2">
              {activeQuestion.choices.map((choice, i) => {
                const isSelected = selectedChoices.has(choice.id);
                const letter = LETTERS[i];
                return (
                  <button
                    key={choice.id}
                    onClick={() => toggleChoice(choice.id)}
                    disabled={feedback !== null}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border text-[13px] transition-all flex items-center gap-3",
                      isSelected && feedback === null && "border-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10 text-[#0071E3]",
                      feedback === "correct" && isSelected && "border-green-500 bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400",
                      feedback === "wrong" && isSelected && "border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600",
                      feedback === null && !isSelected && "border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#ADADB8] text-[#1D1D1F] dark:text-[#F5F5F7]",
                      feedback !== null && !isSelected && "border-[#E5E5EA] dark:border-[#3A3A3C] opacity-50 text-[#1D1D1F] dark:text-[#F5F5F7]"
                    )}
                  >
                    <span className={cn(
                      "w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center shrink-0 transition-all",
                      isSelected && feedback === null ? "bg-[#0071E3] text-white"
                      : feedback === "correct" && isSelected ? "bg-green-500 text-white"
                      : feedback === "wrong" && isSelected ? "bg-red-400 text-white"
                      : "bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#3A3A3C] dark:text-[#E5E5EA]"
                    )}>
                      {letter}
                    </span>
                    {choice.text}
                  </button>
                );
              })}
            </div>

            {feedback === "correct" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 dark:text-emerald-400 text-[13px] font-medium">
                  <CheckCircle className="w-4 h-4" /> {t("correct")}
                </div>
                {activeQuestion.explanation && (
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] italic bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-3 py-2">
                    {activeQuestion.explanation}
                  </p>
                )}
              </div>
            )}

            {feedback === "wrong" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-500 text-[13px] font-medium">
                  <XCircle className="w-4 h-4" /> {t("wrong")}
                </div>
                <button
                  onClick={retryQuestion}
                  className="w-full py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
                >
                  {t("retry")}
                </button>
              </div>
            )}

            {feedback === null && (
              <button
                onClick={submitAnswer}
                disabled={selectedChoices.size === 0}
                className="w-full py-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-xl transition-colors"
              >
                {t("validate")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
