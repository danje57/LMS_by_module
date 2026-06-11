import { prisma } from "@/lib/prisma";
import { CourseList, type CourseProgress, type CourseMeta } from "@/components/courses/course-list";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

type CourseStats = Record<string, { assigned: number; completed: number }>;

async function getCourseStats(
  courseIds: string[],
  isAdmin: boolean,
  isManager: boolean,
  userId: string,
): Promise<CourseStats> {
  if (!courseIds.length) return {};

  let teamMemberIds: string[] | null = null;
  let ownCourseIds: Set<string> | null = null;

  if (isManager) {
    const [teamRows, ownCourses] = await Promise.all([
      prisma.userTeam.findMany({
        where: { team: { managerId: userId } },
        select: { userId: true },
      }),
      prisma.course.findMany({
        where: { id: { in: courseIds }, createdById: userId },
        select: { id: true },
      }),
    ]);
    teamMemberIds = teamRows.map((r) => r.userId);
    ownCourseIds = new Set(ownCourses.map((c) => c.id));
    if (!teamMemberIds.length && !ownCourseIds.size) return {};
  }

  const [assignmentRows, certRows] = await Promise.all([
    prisma.courseAssignment.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, userId: true },
    }),
    prisma.certificate.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, userId: true },
    }),
  ]);

  // For managers: own courses → all assignments; other courses → team members only
  const teamSet = teamMemberIds ? new Set(teamMemberIds) : null;
  const filteredAssignments = teamSet || ownCourseIds
    ? assignmentRows.filter((a) => ownCourseIds?.has(a.courseId) || teamSet?.has(a.userId))
    : assignmentRows;
  const filteredCerts = teamSet || ownCourseIds
    ? certRows.filter((c) => c.courseId && (ownCourseIds?.has(c.courseId) || teamSet?.has(c.userId)))
    : certRows;

  // Only count completions for users who are actually assigned to the course
  const assignedPairs = new Set(filteredAssignments.map((a) => `${a.courseId}:${a.userId}`));

  const stats: CourseStats = {};
  for (const row of filteredAssignments) {
    if (!row.courseId) continue;
    if (!stats[row.courseId]) stats[row.courseId] = { assigned: 0, completed: 0 };
    stats[row.courseId].assigned++;
  }
  for (const cert of filteredCerts) {
    if (!cert.courseId || !assignedPairs.has(`${cert.courseId}:${cert.userId}`)) continue;
    if (stats[cert.courseId]) stats[cert.courseId].completed++;
    else stats[cert.courseId] = { assigned: 0, completed: 1 };
  }
  return stats;
}

async function getCourses(isAdmin: boolean, isManagerOrCreator: boolean, userId: string) {
  if (isAdmin || isManagerOrCreator) {
    return prisma.course.findMany({ where: { isActive: true, courseType: { not: "pdf" } }, orderBy: { createdAt: "desc" } });
  }
  return prisma.course.findMany({
    where: { isActive: true, courseType: { not: "pdf" }, assignments: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
}

// Cours qu'un manager est autorisé à affecter (ses cours + ceux des créateurs de ses équipes)
async function getManagerAssignableIds(managerId: string): Promise<Set<string>> {
  const managedTeams = await prisma.team.findMany({
    where: { managerId },
    include: { members: { select: { userId: true } } },
  });
  const teamMemberIds = managedTeams.flatMap((t) => t.members.map((m) => m.userId));
  const creatorMembers = teamMemberIds.length
    ? await prisma.userRole.findMany({
        where: { userId: { in: teamMemberIds }, role: { name: "creator" } },
        select: { userId: true },
      })
    : [];
  const authorizedIds = new Set([managerId, ...creatorMembers.map((r) => r.userId)]);
  const assignable = await prisma.course.findMany({
    where: { isActive: true, courseType: { not: "pdf" }, createdById: { in: [...authorizedIds] } },
    select: { id: true },
  });
  return new Set(assignable.map((c) => c.id));
}

// Cours que le manager/creator est autorisé à affecter :
// - manager : ses propres cours + ceux des creators membres de ses équipes
// - creator  : ses propres cours + ceux du/des manager(s) de ses équipes (même périmètre)
async function getAssignableCourseIds(userId: string): Promise<Set<string>> {
  const isManager = await prisma.userRole.findFirst({
    where: { userId, role: { name: "manager" } },
  });

  if (isManager) return getManagerAssignableIds(userId);

  // Créateur : ses cours + scope de son/ses manager(s)
  const [own, creatorTeams] = await Promise.all([
    prisma.course.findMany({ where: { createdById: userId, isActive: true, courseType: { not: "pdf" } }, select: { id: true } }),
    prisma.userTeam.findMany({ where: { userId }, include: { team: { select: { managerId: true } } } }),
  ]);
  const result = new Set(own.map((c) => c.id));
  const managerIds = [...new Set(creatorTeams.map((ut) => ut.team.managerId).filter(Boolean) as string[])];
  await Promise.all(managerIds.map(async (mId) => {
    const ids = await getManagerAssignableIds(mId);
    ids.forEach((id) => result.add(id));
  }));
  return result;
}

async function getCourseMeta(
  userId: string,
  courseIds: string[],
  isAdmin: boolean,
): Promise<{ metaMap: Record<string, CourseMeta>; assignedCourseIds: string[] }> {
  if (courseIds.length === 0) return { metaMap: {}, assignedCourseIds: [] };

  const [createdByRows, assignmentRows] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, createdBy: { select: { name: true, teams: { select: { team: { select: { name: true } } } } } } },
    }),
    isAdmin
      ? Promise.resolve([] as { courseId: string; assignedBy: { name: string | null } | null; dueDate: Date | null; assignedAt: Date }[])
      : prisma.courseAssignment.findMany({
          where: { userId, courseId: { in: courseIds } },
          select: { courseId: true, assignedBy: { select: { name: true } }, dueDate: true, assignedAt: true },
        }),
  ]);

  const createdByMap      = new Map(createdByRows.map((c) => [c.id, c.createdBy?.name ?? null]));
  const createdByTeamsMap = new Map(createdByRows.map((c) => [c.id, c.createdBy?.teams.map((t) => t.team.name) ?? []]));
  const assignedByMap = new Map(assignmentRows.map((a) => [a.courseId, a.assignedBy?.name ?? null]));
  const dueDateMap    = new Map(assignmentRows.map((a) => [a.courseId, a.dueDate?.toISOString() ?? null]));
  const assignedAtMap = new Map(assignmentRows.map((a) => [a.courseId, a.assignedAt?.toISOString() ?? null]));

  const metaMap: Record<string, CourseMeta> = {};
  for (const id of courseIds) {
    metaMap[id] = {
      createdByName:  createdByMap.get(id) ?? null,
      createdByTeams: createdByTeamsMap.get(id) ?? [],
      assignedByName: assignedByMap.get(id) ?? null,
      dueDate:    dueDateMap.get(id) ?? null,
      assignedAt: assignedAtMap.get(id) ?? null,
    };
  }

  return { metaMap, assignedCourseIds: assignmentRows.map((a) => a.courseId) };
}

async function getProgressMap(userId: string): Promise<Record<string, CourseProgress>> {
  const [progressRows, certRows] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      select: { courseId: true, visitedSlides: true, completedAt: true, lastAccessAt: true },
    }),
    prisma.certificate.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      select: { id: true, courseId: true, quizPassed: true },
    }),
  ]);

  // Latest cert per course (already sorted desc)
  const certMap = new Map<string, { id: string; quizPassed: boolean | null }>();
  for (const c of certRows) {
    if (c.courseId && !certMap.has(c.courseId)) certMap.set(c.courseId, { id: c.id, quizPassed: c.quizPassed });
  }

  const map: Record<string, CourseProgress> = {};
  for (const p of progressRows) {
    const cert = certMap.get(p.courseId);
    let status: CourseProgress["status"] = "not_started";
    if (cert) status = "completed";
    else if (p.completedAt || p.visitedSlides.length > 0 || !!p.lastAccessAt) status = "in_progress";

    map[p.courseId] = {
      status,
      completedAt: p.completedAt ?? null,
      quizPassed: cert?.quizPassed ?? null,
      latestCertificateId: cert?.id ?? null,
    };
  }

  return map;
}

export default async function CoursesPage() {
  const session = await auth();
  const isAdmin = session?.user.sessionMode === "admin";
  const userId = session?.user.id ?? "";
  const t = await getTranslations("courses");
  const tNav = await getTranslations("nav");

  const [roleRecord, managerRecord] = !isAdmin && userId
    ? await Promise.all([
        prisma.userRole.findFirst({ where: { userId, role: { name: { in: ["manager", "creator"] } } } }),
        prisma.userRole.findFirst({ where: { userId, role: { name: "manager" } } }),
      ])
    : [null, null];
  const isManagerOrCreator = !isAdmin && roleRecord !== null;
  const isManager = !isAdmin && managerRecord !== null;

  const courses = await getCourses(isAdmin ?? false, isManagerOrCreator, userId);
  const courseIds = courses.map((c) => c.id);

  const [progressMap, { metaMap, assignedCourseIds }, assignableCourseIds, statsMap] = await Promise.all([
    isAdmin ? Promise.resolve({} as Record<string, CourseProgress>) : getProgressMap(userId),
    getCourseMeta(userId, courseIds, isAdmin ?? false),
    isManagerOrCreator ? getAssignableCourseIds(userId) : Promise.resolve(new Set<string>()),
    (isAdmin || isManager) ? getCourseStats(courseIds, isAdmin ?? false, isManager, userId) : Promise.resolve({} as CourseStats),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{tNav("courses")}</h1>
          <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            {isManagerOrCreator
              ? t("assignedTrainings", { count: assignedCourseIds.length })
              : isAdmin
              ? t("availableCourses", { count: courses.length })
              : t("assignedTrainings", { count: courses.length })
            }
          </p>
        </div>
        {(isAdmin || isManagerOrCreator) && (
          <Link
            href="/dashboard/courses/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("addCourse")}
          </Link>
        )}
      </div>
      <CourseList
        courses={courses}
        isAdmin={isAdmin ?? false}
        isManagerOrCreator={isManagerOrCreator}
        progressMap={progressMap}
        metaMap={metaMap}
        assignedCourseIds={isManagerOrCreator ? assignedCourseIds : undefined}
        assignableCourseIds={isManagerOrCreator ? assignableCourseIds : undefined}
        statsMap={(isAdmin || isManager) ? statsMap : undefined}
      />
    </div>
  );
}
