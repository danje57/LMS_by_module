"use client";

import { useState } from "react";
import type { Course } from "@prisma/client";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { Search, Clock, CircleCheck, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CourseListProps {
  courses: Course[];
}

export function CourseList({ courses }: CourseListProps) {
  const [search, setSearch] = useState("");
  const [filterQuiz, setFilterQuiz] = useState<"all" | "yes" | "no">("all");

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchQuiz =
      filterQuiz === "all" || (filterQuiz === "yes" ? c.hasQuiz : !c.hasQuiz);
    return matchSearch && matchQuiz;
  });

  return (
    <div className="space-y-5">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Rechercher un cours…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D2D2D7] bg-white text-[14px] text-[#1D1D1F] placeholder:text-[#ADADB8] outline-none focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 transition-all"
          />
        </div>

        <div className="flex gap-1.5 bg-white border border-[#D2D2D7] rounded-xl p-1">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterQuiz(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                filterQuiz === v
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              {v === "all" ? "Tous" : v === "yes" ? "Avec quiz" : "Sans quiz"}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#ADADB8]" />
          </div>
          <p className="text-[15px] font-medium text-[#1D1D1F]">Aucun cours trouvé</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Modifiez vos filtres ou ajoutez un cours.</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((course) => (
          <div
            key={course.id}
            className="group bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden hover:shadow-md hover:border-[#D2D2D7] transition-all"
          >
            {/* Color band */}
            <div className="h-1.5 bg-gradient-to-r from-[#0071E3] to-[#40B3FF]" />

            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1D1D1F] leading-snug line-clamp-2">
                  {course.title}
                </h3>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] bg-[#F5F5F7] rounded-lg px-2.5 py-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(course.duration)}
                </span>
                {course.hasQuiz && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1">
                    <CircleCheck className="w-3 h-3" />
                    Quiz · {course.passingScore}%
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#ADADB8]">{formatFileSize(course.fileSize)}</span>
                <Link
                  href={`/dashboard/courses/${course.id}/play`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Lancer
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
