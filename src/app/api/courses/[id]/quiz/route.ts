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

  const result = await prisma.userQuizResult.create({
    data: {
      userId: session.user.id,
      courseId: id,
      attempt,
      score,
      passingScore: course.passingScore ?? 80,
      passed,
      answersData: answers,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
