import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { H5PPlayer } from "@/components/courses/h5p-player";
import { PlayPageClient } from "./play-page-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayCoursePage({ params }: Props) {
  await auth();
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id, isActive: true } });
  if (!course) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>
      <PlayPageClient
        courseId={course.id}
        filePath={course.filePath}
        hasQuiz={course.hasQuiz}
        passingScore={course.passingScore ?? 80}
      />
    </div>
  );
}
