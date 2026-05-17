import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { answers, score, passed } = await req.json();

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  const attempt = await prisma.userQuizResult.count({ where: { userId: session.user.id, courseId: id } }) + 1;

  const passingScore = course.passingScore ?? 80;

  const result = await prisma.userQuizResult.create({
    data: {
      userId: session.user.id,
      courseId: id,
      attempt,
      score,
      passingScore,
      passed,
      answersData: answers,
    },
  });

  let certificateId: string | null = null;
  let certificateCompletedAt: Date | null = null;

  if (passed) {
    // Ne créer un certificat que si aucun n'existe déjà pour ce cycle
    const existingCert = await prisma.certificate.findFirst({
      where: { userId: session.user.id, courseId: id },
      select: { id: true, completedAt: true },
    });
    if (!existingCert) {
      const progress = await prisma.userCourseProgress.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: id } },
        select: { completedAt: true },
      });
      const completedAt = progress?.completedAt ?? new Date();
      const cert = await prisma.certificate.create({
        data: {
          userId: session.user.id,
          courseId: id,
          courseTitle: course.title,
          completedAt,
          hasQuiz: true,
          quizPassed: true,
          quizScore: score,
          passingScore,
        },
      });
      certificateId = cert.id;
      certificateCompletedAt = completedAt;
    } else {
      // Certificat déjà obtenu pour ce cycle — on renvoie l'id existant
      certificateId = existingCert.id;
      certificateCompletedAt = existingCert.completedAt;
    }
  } else {
    await prisma.certificate.deleteMany({
      where: { userId: session.user.id, courseId: id },
    });
  }

  return NextResponse.json({ ...result, certificateId, certificateCompletedAt }, { status: 201 });
}
