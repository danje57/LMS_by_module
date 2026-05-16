import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// Format CSV : question;type;choiceA;choiceB;choiceC;choiceD;correctAnswer;explanation
// type : qcm | vrai_faux
// correctAnswer QCM : A|B|C|D   vrai_faux : vrai|faux
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const text = await req.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Ignorer la ligne d'en-tête si elle commence par "question"
  const dataLines = lines[0]?.toLowerCase().startsWith("question") ? lines.slice(1) : lines;

  if (dataLines.length === 0) return NextResponse.json({ error: "Fichier vide" }, { status: 400 });

  // Récupérer l'ordre de départ
  const last = await prisma.quizQuestion.findFirst({ where: { courseId: id }, orderBy: { order: "desc" } });
  let order = (last?.order ?? 0) + 1;

  const created: number[] = [];
  const errors: string[] = [];

  for (const line of dataLines) {
    // Gestion des guillemets CSV simples
    const cols = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    const [question, type, choiceA, choiceB, choiceC, choiceD, choiceE, choiceF, choiceG, choiceH, choiceI, choiceJ, correctAnswer, explanation] = cols;

    if (!question || !correctAnswer) { errors.push(`Ligne ignorée (manque question ou réponse) : ${line.slice(0, 60)}`); continue; }

    const qtype = type === "vrai_faux" ? "vrai_faux" : "qcm";
    let validAnswer: string | null = null;
    let allowMultiple = false;
    if (qtype === "vrai_faux") {
      validAnswer = ["vrai", "faux"].includes(correctAnswer.toLowerCase()) ? correctAnswer.toLowerCase() : null;
    } else {
      const validLetters = ["A","B","C","D","E","F","G","H","I","J"];
      const letters = correctAnswer.toUpperCase().split(",").map((s) => s.trim());
      const allValid = letters.every((l) => validLetters.includes(l));
      if (allValid) { validAnswer = letters.join(","); allowMultiple = letters.length > 1; }
    }

    if (!validAnswer) { errors.push(`Réponse invalide "${correctAnswer}" ligne : ${question.slice(0, 40)}`); continue; }

    await prisma.quizQuestion.create({
      data: { courseId: id, order: order++, type: qtype as "qcm" | "vrai_faux", question, choiceA: choiceA || null, choiceB: choiceB || null, choiceC: choiceC || null, choiceD: choiceD || null, choiceE: choiceE || null, choiceF: choiceF || null, choiceG: choiceG || null, choiceH: choiceH || null, choiceI: choiceI || null, choiceJ: choiceJ || null, correctAnswer: validAnswer, allowMultiple, explanation: explanation || null },
    });
    created.push(order);
  }

  await prisma.course.update({ where: { id }, data: { hasQuiz: true } });
  return NextResponse.json({ imported: created.length, errors });
}
