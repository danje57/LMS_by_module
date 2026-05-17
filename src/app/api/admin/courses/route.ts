import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    select: { id: true, title: true, hasQuiz: true, passingScore: true },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(courses);
}
