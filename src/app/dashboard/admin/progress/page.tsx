import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "@/components/admin/progress-client";
import type { UserProgressRow, CourseRef, TeamRef, CourseStatus, DocStatus, DocAssignmentRow } from "@/components/admin/progress-client";
import type { AssignmentRow } from "@/components/admin/progress-client";
import { getTranslations } from "next-intl/server";

async function getData() {
  const [allCoursesRaw, teams, userRows] = await Promise.all([
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true, courseType: true },
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
        assignments: {
          select: {
            courseId: true,
            dueDate: true,
            assignedAt: true,
            course: { select: { id: true, title: true, courseType: true } },
          },
        },
        courseProgress: { select: { courseId: true, progress: true } },
        certificates: { select: { courseId: true } },
        pdfSignatures: { select: { courseId: true, signedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const courses: CourseRef[] = allCoursesRaw
    .filter((c) => c.courseType !== "pdf")
    .map((c) => ({ id: c.id, title: c.title }));

  const docs: CourseRef[] = allCoursesRaw
    .filter((c) => c.courseType === "pdf")
    .map((c) => ({ id: c.id, title: c.title }));

  const docIds = docs.map((d) => d.id);

  const viewLogsRaw = docIds.length > 0
    ? await prisma.auditLog.findMany({
        where: { action: "document.view", targetId: { in: docIds }, actorId: { not: null } },
        select: { actorId: true, targetId: true },
      })
    : [];

  const viewSet = new Set(
    viewLogsRaw
      .filter((v) => v.actorId && v.targetId)
      .map((v) => `${v.actorId}:${v.targetId}`)
  );

  const users: UserProgressRow[] = userRows.map((u) => {
    const progressMap = new Map(u.courseProgress.map((p) => [p.courseId, p.progress]));
    const certSet = new Set(u.certificates.map((c) => c.courseId).filter(Boolean) as string[]);
    const sigMap = new Map(u.pdfSignatures.map((s) => [s.courseId, s.signedAt]));

    const courseAssignments = u.assignments.filter((a) => a.course.courseType !== "pdf");
    const pdfAssignments    = u.assignments.filter((a) => a.course.courseType === "pdf");

    const assignments: AssignmentRow[] = courseAssignments.map((a) => {
      const isDone = certSet.has(a.courseId);
      const prog   = progressMap.get(a.courseId) ?? 0;
      const status: CourseStatus = isDone ? "completed" : prog > 0 ? "in_progress" : "not_started";
      return {
        courseId:   a.courseId,
        courseTitle: a.course.title,
        status,
        progress:   isDone ? 100 : prog,
        dueDate:    a.dueDate?.toISOString() ?? null,
        assignedAt: a.assignedAt?.toISOString() ?? null,
      };
    });

    const docAssignments: DocAssignmentRow[] = pdfAssignments.map((a) => {
      const sig      = sigMap.get(a.courseId);
      const isViewed = viewSet.has(`${u.id}:${a.courseId}`);
      const status: DocStatus = sig ? "signed" : isViewed ? "in_progress" : "not_started";
      return {
        docId:      a.courseId,
        docTitle:   a.course.title,
        status,
        signedAt:   sig?.toISOString() ?? null,
        dueDate:    a.dueDate?.toISOString() ?? null,
        assignedAt: a.assignedAt?.toISOString() ?? null,
      };
    });

    return {
      id:    u.id,
      name:  u.name,
      email: u.email,
      teams: u.teams.map((ut) => ({ id: ut.team.id, name: ut.team.name })),
      assignments,
      docAssignments,
    };
  });

  return { courses, docs, teams, users };
}

export default async function ProgressPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { courses, docs, teams, users } = await getData();
  const t = await getTranslations("progress");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{t("title")}</h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("subtitle")}
        </p>
      </div>
      <ProgressClient courses={courses} docs={docs} teams={teams} users={users} />
    </div>
  );
}
