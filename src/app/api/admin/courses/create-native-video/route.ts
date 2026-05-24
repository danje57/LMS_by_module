import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const title = body.title?.trim();
  const duration = parseInt(body.duration ?? "", 10);
  const passingScore = body.passingScore ? Math.max(0, Math.min(100, parseInt(body.passingScore, 10))) : null;
  const scoreVideoQuestions = !!body.scoreVideoQuestions;
  const showVideoAnswers = body.showVideoAnswers !== false;
  const createdById = isAdmin ? (body.createdById?.trim() || null) : session.user.id;

  if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  if (isNaN(duration) || duration < 1) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });

  // Catégorie = équipe du créateur
  let category: string | null = null;
  if (createdById) {
    const managedTeam = await prisma.team.findFirst({ where: { managerId: createdById }, select: { name: true } });
    if (managedTeam) {
      category = managedTeam.name;
    } else {
      const userTeam = await prisma.userTeam.findFirst({ where: { userId: createdById }, include: { team: { select: { name: true } } } });
      category = userTeam?.team.name ?? null;
    }
  }

  const course = await prisma.course.create({
    data: {
      title,
      category,
      duration,
      hasQuiz: false,
      passingScore,
      scoreVideoQuestions,
      showVideoAnswers,
      filePath: "",
      originalFileName: "",
      fileSize: BigInt(0),
      courseType: "native_video",
      createdById,
    },
  });

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "course.upload", targetId: course.id, targetLabel: title });
  return NextResponse.json({ ok: true, courseId: course.id });
}
