import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "./progress-client";

export type CourseStatus = "not_started" | "in_progress" | "completed";

export type AssignmentRow = {
  courseId: string;
  courseTitle: string;
  status: CourseStatus;
  progress: number;
};

export type UserProgressRow = {
  id: string;
  name: string | null;
  email: string;
  teams: { id: string; name: string }[];
  assignments: AssignmentRow[];
};

export type CourseRef = { id: string; title: string };
export type TeamRef   = { id: string; name: string };

async function getData() {
  const [courses, teams, userRows] = await Promise.all([
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { name: "learner" } } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        teams: { include: { team: { select: { id: true, name: true } } } },
        assignments: { include: { course: { select: { id: true, title: true } } } },
        courseProgress: { select: { courseId: true, progress: true } },
        certificates: { select: { courseId: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const users: UserProgressRow[] = userRows.map((u) => {
    const progressMap = new Map(u.courseProgress.map((p) => [p.courseId, p.progress]));
    const certSet = new Set(u.certificates.map((c) => c.courseId).filter(Boolean) as string[]);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      teams: u.teams.map((ut) => ({ id: ut.team.id, name: ut.team.name })),
      assignments: u.assignments.map((a) => {
        const isDone = certSet.has(a.courseId);
        const prog = progressMap.get(a.courseId) ?? 0;
        const status: CourseStatus = isDone ? "completed" : prog > 0 ? "in_progress" : "not_started";
        return {
          courseId: a.courseId,
          courseTitle: a.course.title,
          status,
          progress: isDone ? 100 : prog,
        };
      }),
    };
  });

  return { courses, teams, users };
}

export default async function ProgressPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { courses, teams, users } = await getData();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Suivi de la formation</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          Progression des apprenants par équipe et par cours.
        </p>
      </div>
      <ProgressClient courses={courses} teams={teams} users={users} />
    </div>
  );
}
