import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    update: { visitedSlides, lastAccessAt: new Date() },
    create: { userId: session.user.id, courseId: id, visitedSlides },
  });

  return NextResponse.json({ ok: true });
}

// Marque le cours comme terminé et sauvegarde les slides
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const visitedSlides: number[] = Array.isArray(body?.visitedSlides) ? body.visitedSlides : [];

  // Check if this is a new completion (completedAt was null)
  const existing = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    select: { completedAt: true },
  });

  const now = new Date();
  const progress = await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    update: { completedAt: now, lastAccessAt: now, progress: 100, visitedSlides },
    create: { userId: session.user.id, courseId: id, progress: 100, completedAt: now, visitedSlides },
  });

  // Create certificate only if course has no quiz (quiz-gated courses get their cert on quiz pass)
  if (!existing?.completedAt) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: { title: true, hasQuiz: true },
    });
    if (course && !course.hasQuiz) {
      await prisma.certificate.create({
        data: {
          userId: session.user.id,
          courseId: id,
          courseTitle: course.title,
          completedAt: now,
          hasQuiz: false,
        },
      });
    }
  }

  return NextResponse.json({ completed: true, completedAt: progress.completedAt });
}
