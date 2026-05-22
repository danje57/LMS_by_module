import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;

  const [assignedCount, completedCount, quizAgg, certCount] = await Promise.all([
    prisma.courseAssignment.count({ where: { courseId: id } }),
    prisma.userCourseProgress.count({ where: { courseId: id, completedAt: { not: null } } }),
    prisma.userQuizResult.aggregate({
      where: { courseId: id },
      _avg: { score: true },
      _count: { id: true },
    }),
    prisma.certificate.count({ where: { courseId: id } }),
  ]);

  return NextResponse.json({
    assignedCount,
    completedCount,
    completionRate: assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0,
    avgQuizScore: quizAgg._avg.score !== null ? Math.round(quizAgg._avg.score) : null,
    quizAttempts: quizAgg._count.id,
    certCount,
  });
}
