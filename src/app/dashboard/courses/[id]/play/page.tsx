import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PlayPageClient } from "./play-page-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayCoursePage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  const [course, branding] = await Promise.all([
    prisma.course.findUnique({ where: { id, isActive: true } }),
    prisma.brandingSetting.findFirst({ select: { logoPath: true } }),
  ]);
  if (!course) notFound();

  const nativeVideo = course.courseType === "native_video"
    ? await prisma.nativeVideo.findUnique({
        where: { courseId: id },
        include: { questions: { orderBy: { timestamp: "asc" } } },
      })
    : null;

  const userName = session?.user?.name ?? session?.user?.email ?? "Apprenant";
  const logoPath = branding?.logoPath ? `/api/assets/${branding.logoPath}` : null;

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
        courseTitle={course.title}
        filePath={course.filePath}
        hasQuiz={course.hasQuiz}
        passingScore={course.passingScore ?? 80}
        userName={userName}
        logoPath={logoPath}
        courseType={course.courseType}
        nativeVideo={nativeVideo ? {
          id: nativeVideo.id,
          videoPath: nativeVideo.videoPath,
          duration: nativeVideo.duration,
          scoreVideoQuestions: course.scoreVideoQuestions,
          showVideoAnswers: course.showVideoAnswers,
          questions: nativeVideo.questions.map(q => ({
            id: q.id,
            timestamp: q.timestamp,
            question: q.question,
            choices: q.choices as { id: string; text: string; correct: boolean }[],
            order: q.order,
          })),
        } : null}
      />
    </div>
  );
}
