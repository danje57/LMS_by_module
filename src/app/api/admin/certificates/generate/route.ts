import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { userIds, courseIds } = await req.json() as { userIds: string[]; courseIds: string[] };

  if (!Array.isArray(userIds) || !Array.isArray(courseIds) || userIds.length === 0 || courseIds.length === 0) {
    return NextResponse.json({ error: "userIds et courseIds requis" }, { status: 400 });
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, title: true, hasQuiz: true, passingScore: true },
  });

  const now = new Date();
  let generated = 0;
  let skipped = 0;

  for (const userId of userIds) {
    for (const course of courses) {
      const existing = await prisma.certificate.findFirst({
        where: { userId, courseId: course.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.$transaction([
        prisma.userCourseProgress.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          update: { completedAt: now, progress: 100, lastAccessAt: now },
          create: { userId, courseId: course.id, completedAt: now, progress: 100 },
        }),
        prisma.certificate.create({
          data: {
            userId,
            courseId: course.id,
            courseTitle: course.title,
            completedAt: now,
            hasQuiz: course.hasQuiz,
            quizPassed: course.hasQuiz ? true : null,
            passingScore: course.passingScore,
          },
        }),
      ]);

      generated++;
    }
  }

  await auditLog({ actor: { id: session.user.id, name: session.user.name, email: session.user.email }, action: "certificate.generate", details: { generated, skipped, userIds: userIds.length, courseIds: courseIds.length } });
  return NextResponse.json({ generated, skipped });
}
