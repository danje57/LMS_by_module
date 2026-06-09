import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { userIds, courseIds = [], documentIds = [] } = await req.json() as {
    userIds: string[];
    courseIds?: string[];
    documentIds?: string[];
  };

  if (!Array.isArray(userIds) || userIds.length === 0)
    return NextResponse.json({ error: "userIds requis" }, { status: 400 });

  if (courseIds.length === 0 && documentIds.length === 0)
    return NextResponse.json({ error: "courseIds ou documentIds requis" }, { status: 400 });

  const now = new Date();
  let generated = 0;
  let skipped = 0;

  // ── Cours (formations) ────────────────────────────────────────────────────
  if (courseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true, hasQuiz: true, passingScore: true },
    });

    for (const userId of userIds) {
      for (const course of courses) {
        const existing = await prisma.certificate.findFirst({
          where: { userId, courseId: course.id, isPdf: false },
        });
        if (existing) { skipped++; continue; }

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
              isPdf: false,
            },
          }),
        ]);
        generated++;
      }
    }
  }

  // ── Documents GRC ─────────────────────────────────────────────────────────
  if (documentIds.length > 0) {
    const docs = await prisma.course.findMany({
      where: { id: { in: documentIds }, courseType: "pdf" },
      select: { id: true, title: true },
    });

    for (const userId of userIds) {
      for (const doc of docs) {
        const existing = await prisma.pdfSignature.findUnique({
          where: { userId_courseId: { userId, courseId: doc.id } },
        });
        if (existing) { skipped++; continue; }

        await prisma.$transaction([
          prisma.pdfSignature.create({
            data: { userId, courseId: doc.id, signedAt: now, ipAddress: null },
          }),
          prisma.certificate.create({
            data: {
              userId,
              courseId: doc.id,
              courseTitle: doc.title,
              completedAt: now,
              hasQuiz: false,
              isPdf: true,
              issuedAt: now,
            },
          }),
        ]);
        generated++;
      }
    }
  }

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "certificate.generate",
    details: {
      generated,
      skipped,
      userIds: userIds.length,
      courseIds: courseIds.length,
      documentIds: documentIds.length,
    },
  });

  return NextResponse.json({ generated, skipped });
}
