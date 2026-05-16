import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const progress = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
  });

  return NextResponse.json({ completed: !!progress?.completedAt, completedAt: progress?.completedAt ?? null });
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const progress = await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    update: { completedAt: new Date(), lastAccessAt: new Date() },
    create: { userId: session.user.id, courseId: id, progress: 100, completedAt: new Date() },
  });

  return NextResponse.json({ completed: true, completedAt: progress.completedAt });
}
