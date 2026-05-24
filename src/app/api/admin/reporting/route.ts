import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCourses,
    totalUsers,
    totalCertificates,
    activeThisWeek,
    allProgress,
    allQuizResults,
    courses,
    teams,
    userTeams,
    dailyActivity,
  ] = await Promise.all([
    prisma.course.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.certificate.count(),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        action: { in: ["course.start", "course.complete", "quiz.submit", "certificate.generate", "certificate.download"] },
      },
      distinct: ["actorId"],
      select: { actorId: true },
    }),
    prisma.userCourseProgress.findMany({
      select: { courseId: true, completedAt: true, progress: true },
    }),
    prisma.userQuizResult.findMany({
      select: { courseId: true, score: true, passed: true },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true, courseType: true, hasQuiz: true },
      orderBy: { title: "asc" },
    }),
    prisma.team.findMany({ select: { id: true, name: true } }),
    prisma.userTeam.findMany({ select: { userId: true, teamId: true } }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        action: { in: ["course.start", "course.complete", "quiz.submit"] },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // --- KPIs ---
  const totalCompletions = allProgress.filter((p) => p.completedAt !== null).length;
  const kpis = {
    totalCourses,
    totalUsers,
    totalCertificates,
    totalCompletions,
    activeThisWeek: activeThisWeek.filter((x) => x.actorId).length,
  };

  // --- Stats par cours ---
  const progressByCourse = new Map<string, { total: number; completed: number; progressSum: number }>();
  for (const p of allProgress) {
    const cur = progressByCourse.get(p.courseId) ?? { total: 0, completed: 0, progressSum: 0 };
    cur.total++;
    if (p.completedAt) cur.completed++;
    cur.progressSum += p.progress;
    progressByCourse.set(p.courseId, cur);
  }

  const quizByCourse = new Map<string, { scores: number[]; passed: number }>();
  for (const r of allQuizResults) {
    const cur = quizByCourse.get(r.courseId) ?? { scores: [], passed: 0 };
    cur.scores.push(r.score);
    if (r.passed) cur.passed++;
    quizByCourse.set(r.courseId, cur);
  }

  const courseStats = courses.map((c) => {
    const prog = progressByCourse.get(c.id);
    const quiz = quizByCourse.get(c.id);
    const avgScore = quiz && quiz.scores.length > 0
      ? Math.round(quiz.scores.reduce((a, b) => a + b, 0) / quiz.scores.length)
      : null;
    return {
      id: c.id,
      title: c.title,
      courseType: c.courseType,
      hasQuiz: c.hasQuiz,
      enrolled: prog?.total ?? 0,
      completed: prog?.completed ?? 0,
      completionRate: prog?.total ? Math.round((prog.completed / prog.total) * 100) : 0,
      avgProgress: prog?.total ? Math.round(prog.progressSum / prog.total) : 0,
      avgScore,
      quizAttempts: quiz?.scores.length ?? 0,
      quizPassed: quiz?.passed ?? 0,
    };
  }).filter((c) => c.enrolled > 0);

  // --- Stats par équipe ---
  const membersByTeam = new Map<string, Set<string>>();
  for (const ut of userTeams) {
    const s = membersByTeam.get(ut.teamId) ?? new Set();
    s.add(ut.userId);
    membersByTeam.set(ut.teamId, s);
  }

  const completionsByUser = new Map<string, number>();
  for (const p of allProgress) {
    if (p.completedAt) {
      // we need userId — re-fetch below
    }
  }

  // Fetch per-team completions via user memberships
  const progressWithUser = await prisma.userCourseProgress.findMany({
    where: { completedAt: { not: null } },
    select: { userId: true },
  });
  for (const p of progressWithUser) {
    completionsByUser.set(p.userId, (completionsByUser.get(p.userId) ?? 0) + 1);
  }

  const teamStats = teams.map((t) => {
    const members = membersByTeam.get(t.id) ?? new Set();
    const memberCount = members.size;
    const completions = [...members].reduce((sum, uid) => sum + (completionsByUser.get(uid) ?? 0), 0);
    return {
      id: t.id,
      name: t.name,
      members: memberCount,
      completions,
      avgCompletions: memberCount > 0 ? Math.round((completions / memberCount) * 10) / 10 : 0,
    };
  }).filter((t) => t.members > 0).sort((a, b) => b.completions - a.completions);

  // --- Activité quotidienne (30 derniers jours) ---
  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of dailyActivity) {
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  const activityChart = [...dayMap.entries()].map(([date, count]) => ({
    date,
    label: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    count,
  }));

  return NextResponse.json({ kpis, courseStats, teamStats, activityChart });
}
