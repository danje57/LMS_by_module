"use client";

import { useState } from "react";
import type { Course } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { Search, Clock, HelpCircle, Play } from "lucide-react";
import Link from "next/link";

interface CourseListProps {
  courses: Course[];
}

export function CourseList({ courses }: CourseListProps) {
  const [search, setSearch] = useState("");
  const [filterQuiz, setFilterQuiz] = useState<"all" | "yes" | "no">("all");

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchQuiz =
      filterQuiz === "all" ||
      (filterQuiz === "yes" ? c.hasQuiz : !c.hasQuiz);
    return matchSearch && matchQuiz;
  });

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un cours…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "yes", "no"] as const).map((v) => (
            <Button
              key={v}
              variant={filterQuiz === v ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterQuiz(v)}
            >
              {v === "all" ? "Tous" : v === "yes" ? "Avec quiz" : "Sans quiz"}
            </Button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Aucun cours trouvé
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(course.duration)}
                  </span>
                  {course.hasQuiz && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Quiz — {course.passingScore}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(course.fileSize)}
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/dashboard/courses/${course.id}/play`}>
                    <Play className="h-4 w-4" />
                    Lancer le cours
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
