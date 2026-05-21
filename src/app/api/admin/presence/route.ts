import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const rows = await prisma.userCourseProgress.findMany({
    where: { lastAccessAt: { gte: since } },
    select: {
      lastAccessAt: true,
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { lastAccessAt: "desc" },
  });

  // Dédupliquer par userId — garder le plus récent
  const seen = new Set<string>();
  const active = rows
    .filter((r) => { if (seen.has(r.user.id)) return false; seen.add(r.user.id); return true; })
    .map((r) => ({
      userId: r.user.id,
      name: r.user.name ?? r.user.email,
      email: r.user.email,
      courseId: r.course.id,
      courseTitle: r.course.title,
      lastAccessAt: r.lastAccessAt.toISOString(),
    }));

  return NextResponse.json({ count: active.length, users: active });
}
