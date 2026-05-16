import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; qid: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { qid } = await params;
  const body = await req.json();
  const { type, question, choiceA, choiceB, choiceC, choiceD, choiceE, choiceF, choiceG, choiceH, choiceI, choiceJ, correctAnswer, allowMultiple, explanation, order } = body;

  const updated = await prisma.quizQuestion.update({
    where: { id: qid },
    data: { type, question: question?.trim(), choiceA, choiceB, choiceC, choiceD, choiceE, choiceF, choiceG, choiceH, choiceI, choiceJ, correctAnswer, allowMultiple: allowMultiple !== undefined ? !!allowMultiple : undefined, explanation, ...(order !== undefined ? { order } : {}) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id, qid } = await params;
  await prisma.quizQuestion.delete({ where: { id: qid } });

  // Désactiver hasQuiz si plus aucune question
  const remaining = await prisma.quizQuestion.count({ where: { courseId: id } });
  if (remaining === 0) await prisma.course.update({ where: { id }, data: { hasQuiz: false } });

  return NextResponse.json({ ok: true });
}
