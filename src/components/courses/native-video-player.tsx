"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { CheckCircle, XCircle } from "lucide-react";

interface Choice { id: string; text: string; correct: boolean; }
interface Question { id: string; timestamp: number; question: string; choices: Choice[]; order: number; }
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
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
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

    // Marquer démarré au premier event
    if (!startedRef.current && currentTime > 0) {
      startedRef.current = true;
      void fetch(`/api/courses/${courseId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitedSlides: [] }),
      });
    }

    // Déclencher question si dans la fenêtre de 0.5s et pas encore déclenchée
    for (const q of videoData.questions) {
      if (!triggeredRef.current.has(q.id) && Math.abs(currentTime - q.timestamp) < 0.5) {
        video.pause();
        triggeredRef.current.add(q.id);
        setActiveQuestion(q);
        setSelectedChoice(null);
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

  function submitAnswer() {
    if (!activeQuestion || !selectedChoice) return;
    const choice = activeQuestion.choices.find(c => c.id === selectedChoice);
    const isCorrect = !!choice?.correct;
    setFeedback(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setAnswered(prev => ({ ...prev, [activeQuestion.id]: true }));
      setTimeout(() => {
        setActiveQuestion(null);
        setFeedback(null);
        videoRef.current?.play();
      }, 1200);
    }
  }

  function retryQuestion() {
    setSelectedChoice(null);
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

      {/* Overlay question */}
      {activeQuestion && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{activeQuestion.question}</p>

            <div className="space-y-2">
              {activeQuestion.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => feedback === null && setSelectedChoice(choice.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-[13px] transition-all",
                    selectedChoice === choice.id && feedback === null && "border-[#0071E3] bg-blue-50 text-[#0071E3]",
                    feedback === "correct" && choice.id === selectedChoice && "border-green-500 bg-green-50 text-green-700",
                    feedback === "wrong" && choice.id === selectedChoice && "border-red-400 bg-red-50 text-red-600",
                    feedback === null && selectedChoice !== choice.id && "border-[#E5E5EA] hover:border-[#ADADB8]",
                    feedback !== null && choice.id !== selectedChoice && "border-[#E5E5EA] opacity-50"
                  )}
                >
                  {choice.text}
                </button>
              ))}
            </div>

            {feedback === "correct" && (
              <div className="flex items-center gap-2 text-green-600 text-[13px] font-medium">
                <CheckCircle className="w-4 h-4" /> {t("correct")}
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
                disabled={!selectedChoice}
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
