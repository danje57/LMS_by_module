"use client";

import { useState } from "react";
import { H5PPlayer } from "@/components/courses/h5p-player";
import { QuizPlayer } from "@/components/courses/quiz-player";
import { ClipboardList, BookOpen } from "lucide-react";
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

  if (!hasQuiz) {
    return <H5PPlayer courseId={courseId} filePath={filePath} />;
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#F5F5F7] rounded-xl p-1 w-fit">
        {([["course", "Cours", BookOpen], ["quiz", "Quiz", ClipboardList]] as const).map(([value, label, Icon]) => (
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

      {tab === "course" && <H5PPlayer courseId={courseId} filePath={filePath} />}
      {tab === "quiz" && (
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
