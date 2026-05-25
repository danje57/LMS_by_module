import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const assignments = await prisma.courseAssignment.findMany({
    where: { userId: session.user.id, course: { courseType: "pdf", isActive: true } },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          duration: true,
          fileSize: true,
          originalFileName: true,
          createdAt: true,
          pdfSignatures: {
            where: { userId: session.user.id },
            select: { signedAt: true },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.course.id,
      title: a.course.title,
      duration: a.course.duration,
      fileSize: Number(a.course.fileSize),
      originalFileName: a.course.originalFileName,
      assignedAt: a.assignedAt.toISOString(),
      dueDate: a.dueDate?.toISOString() ?? null,
      signedAt: a.course.pdfSignatures[0]?.signedAt?.toISOString() ?? null,
    }))
  );
}
