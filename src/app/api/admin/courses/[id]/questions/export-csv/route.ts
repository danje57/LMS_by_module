import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  const questions = await prisma.quizQuestion.findMany({ where: { courseId: id }, orderBy: { order: "asc" } });

  const header = "question;type;choiceA;choiceB;choiceC;choiceD;correctAnswer;explanation";
  const rows = questions.map((q) =>
    [q.question, q.type, q.choiceA ?? "", q.choiceB ?? "", q.choiceC ?? "", q.choiceD ?? "", q.correctAnswer, q.explanation ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";")
  );
  // correctAnswer may contain comma-separated values (e.g. "A,C") for multi-answer QCM

  const csv = [header, ...rows].join("\n");
  const filename = `quiz_${(course?.title ?? id).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
