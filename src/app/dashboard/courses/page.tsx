import { prisma } from "@/lib/prisma";
import { CourseList, type CourseProgress } from "@/components/courses/course-list";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";

async function getCourses(isAdmin: boolean, isManagerOrCreator: boolean, userId: string) {
  // Admins et managers/créateurs voient tous les cours actifs
  if (isAdmin || isManagerOrCreator) {
    return prisma.course.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  }
  return prisma.course.findMany({
    where: { isActive: true, assignments: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
}

async function getProgressMap(userId: string): Promise<Record<string, CourseProgress>> {
  const [progressRows, certRows] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      select: { courseId: true, visitedSlides: true, completedAt: true },
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
    else if (p.completedAt || p.visitedSlides.length > 0) status = "in_progress";

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

  const roleRecord = !isAdmin && userId
    ? await prisma.userRole.findFirst({
        where: { userId, role: { name: { in: ["manager", "creator"] } } },
      })
    : null;
  const isManagerOrCreator = !isAdmin && roleRecord !== null;

  const [courses, progressMap] = await Promise.all([
    getCourses(isAdmin ?? false, isManagerOrCreator, userId),
    isAdmin ? Promise.resolve({} as Record<string, CourseProgress>) : getProgressMap(userId),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Cours</h1>
          <p className="text-[15px] text-[#6E6E73] mt-0.5">
            {courses.length} cours {isAdmin ? "disponible" : "disponible"}{courses.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/courses/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Link>
        )}
      </div>
      <CourseList
        courses={courses}
        isAdmin={isAdmin ?? false}
        isManagerOrCreator={isManagerOrCreator}
        progressMap={progressMap}
        assignedCourseIds={isManagerOrCreator
          ? (await prisma.courseAssignment.findMany({ where: { userId }, select: { courseId: true } })).map(a => a.courseId)
          : undefined
        }
      />
    </div>
  );
}
