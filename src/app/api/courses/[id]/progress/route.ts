import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const progress = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
  });

  return NextResponse.json({
    completed: !!progress?.completedAt,
    completedAt: progress?.completedAt ?? null,
    visitedSlides: progress?.visitedSlides ?? [],
  });
}

// Sauvegarde intermédiaire des slides visitées (sans marquer le cours comme terminé)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { visitedSlides } = await req.json();

  if (!Array.isArray(visitedSlides)) {
    return NextResponse.json({ error: "visitedSlides doit être un tableau" }, { status: 400 });
  }

  const existing = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    select: { userId: true },
  });

  await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    update: { visitedSlides, lastAccessAt: new Date() },
    create: { userId: session.user.id, courseId: id, visitedSlides },
  });

  if (!existing) {
    const course = await prisma.course.findUnique({ where: { id }, select: { title: true } });
    void auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.start", targetId: id, targetLabel: course?.title ?? null });
  }

  return NextResponse.json({ ok: true });
}

// Marque le cours comme terminé et sauvegarde les slides
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const visitedSlides: number[] = Array.isArray(body?.visitedSlides) ? body.visitedSlides : [];
  const h5pScore: { scaled: number; raw: number; max: number } | null = body?.h5pScore ?? null;

  // Check if this is a new completion (completedAt was null)
  const existing = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    select: { completedAt: true },
  });

  const course = await prisma.course.findUnique({
    where: { id },
    select: { title: true, hasQuiz: true, passingScore: true },
  });

  // Vérifier le seuil de réussite pour H5P Interactive Video
  const scorePercent = h5pScore ? Math.round(h5pScore.scaled * 100) : null;
  const threshold = course?.passingScore ?? 0;
  const passesScore = scorePercent === null || threshold === 0 || scorePercent >= threshold;

  const now = new Date();
  await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    update: {
      ...(passesScore ? { completedAt: now, progress: 100 } : {}),
      lastAccessAt: now,
      visitedSlides,
    },
    create: { userId: session.user.id, courseId: id, progress: passesScore ? 100 : 0, completedAt: passesScore ? now : undefined, visitedSlides },
  });

  // Créer le certificat uniquement si pas de quiz séparé ET score suffisant
  if (!existing?.completedAt && passesScore) {
    if (course && !course.hasQuiz) {
      await prisma.certificate.create({
        data: {
          userId: session.user.id,
          courseId: id,
          courseTitle: course.title,
          completedAt: now,
          hasQuiz: false,
          ...(h5pScore ? {
            quizScore: scorePercent,
            quizPassed: true,
          } : {}),
        },
      });
    }
    void auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.complete", targetId: id, targetLabel: course?.title ?? null });
    if (course) {
      void createNotification({
        userId:  session.user.id,
        type:    "course_completed",
        title:   "Cours terminé 🎉",
        message: `Félicitations ! Vous avez complété "${course.title}".${!course.hasQuiz ? " Votre certificat est disponible." : " Passez le quiz pour obtenir votre certificat."}`,
        link:    "/dashboard/courses",
      });
    }
  }

  return NextResponse.json({ ok: true, passed: passesScore, score: scorePercent, threshold });
}
