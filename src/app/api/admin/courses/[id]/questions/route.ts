import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const questions = await prisma.quizQuestion.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(questions);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { type, question, choiceA, choiceB, choiceC, choiceD, choiceE, choiceF, choiceG, choiceH, choiceI, choiceJ, correctAnswer, allowMultiple, explanation } = body;

  if (!question?.trim()) return NextResponse.json({ error: "Question requise" }, { status: 400 });
  if (!correctAnswer) return NextResponse.json({ error: "Bonne réponse requise" }, { status: 400 });

  const last = await prisma.quizQuestion.findFirst({ where: { courseId: id }, orderBy: { order: "desc" } });
  const order = (last?.order ?? 0) + 1;

  const created = await prisma.quizQuestion.create({
    data: { courseId: id, order, type: type ?? "qcm", question: question.trim(), choiceA, choiceB, choiceC, choiceD, choiceE, choiceF, choiceG, choiceH, choiceI, choiceJ, correctAnswer, allowMultiple: !!allowMultiple, explanation },
  });

  // Activer le flag hasQuiz sur le cours
  await prisma.course.update({ where: { id }, data: { hasQuiz: true } });

  return NextResponse.json(created, { status: 201 });
}
