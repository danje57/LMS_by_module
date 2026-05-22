import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "@/components/admin/progress-client";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import type { UserProgressRow, CourseStatus, AssignmentRow } from "@/components/admin/progress-client";
import { getTranslations } from "next-intl/server";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  teams: { include: { team: { select: { id: true, name: true } } } },
  assignments: { select: { courseId: true, dueDate: true, assignedAt: true, course: { select: { id: true, title: true } } } },
  courseProgress: { select: { courseId: true, progress: true } },
  certificates: { select: { courseId: true } },
} as const;

function buildUserRow(u: {
  id: string;
  name: string | null;
  email: string;
  teams: { team: { id: string; name: string } }[];
  assignments: { courseId: string; dueDate: Date | null; assignedAt: Date; course: { id: string; title: string } }[];
  courseProgress: { courseId: string; progress: number }[];
  certificates: { courseId: string | null }[];
}): UserProgressRow {
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
        dueDate: a.dueDate?.toISOString() ?? null,
        assignedAt: a.assignedAt?.toISOString() ?? null,
      };
    }),
  };
}

async function getManagerData(userId: string) {
  // Équipes gérées + utilisateurs à qui ce manager a affecté des cours (hors équipe)
  // Équipes gérées par ce manager
  const managedTeams = await prisma.team.findMany({
    where: { managerId: userId },
    select: { id: true, name: true, members: { include: { user: { select: USER_SELECT } } } },
  });

  // Affectations rattachées aux équipes du manager (via assigningTeamId) OU faites directement par lui
  const managedTeamIds = managedTeams.map((t) => t.id);
  const teamAssignments = managedTeamIds.length > 0
    ? await prisma.courseAssignment.findMany({
        where: { assigningTeamId: { in: managedTeamIds } },
        include: { user: { select: USER_SELECT } },
      })
    : [];
  const directAssignments = await prisma.courseAssignment.findMany({
    where: { assignedById: userId, assigningTeamId: null },
    include: { user: { select: USER_SELECT } },
  });

  const hasScope = managedTeams.length > 0 || teamAssignments.length > 0 || directAssignments.length > 0;
  if (!hasScope) return null;

  const teams = managedTeams.map((t) => ({ id: t.id, name: t.name }));

  // Union des utilisateurs : membres des équipes + destinataires des affectations
  const seenIds = new Set<string>();
  const rawUsers: (typeof teamAssignments)[number]["user"][] = [];

  for (const t of managedTeams) {
    for (const m of t.members) {
      if (!seenIds.has(m.user.id)) { seenIds.add(m.user.id); rawUsers.push(m.user); }
    }
  }
  for (const a of [...teamAssignments, ...directAssignments]) {
    if (!seenIds.has(a.user.id)) { seenIds.add(a.user.id); rawUsers.push(a.user); }
  }

  // Cours visibles = cours assignés à ces utilisateurs (tous, pas seulement par ce manager)
  const courseMap = new Map<string, string>();
  for (const u of rawUsers) {
    for (const a of u.assignments) courseMap.set(a.course.id, a.course.title);
  }
  const courses = [...courseMap.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const users: UserProgressRow[] = rawUsers
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map(buildUserRow);

  return { courses, teams, users };
}

async function getMyProgress(userId: string): Promise<AssignmentRow[]> {
  const assignments = await prisma.courseAssignment.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, title: true } },
    },
  });
  if (assignments.length === 0) return [];

  const courseIds = assignments.map((a) => a.courseId);
  const [progressRows, certRows] = await Promise.all([
    prisma.userCourseProgress.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true, progress: true } }),
    prisma.certificate.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true } }),
  ]);
  const progressMap = new Map(progressRows.map((p) => [p.courseId, p.progress]));
  const certSet = new Set(certRows.map((c) => c.courseId).filter(Boolean) as string[]);

  return assignments.map((a) => {
    const isDone = certSet.has(a.courseId);
    const prog = progressMap.get(a.courseId) ?? 0;
    const status: CourseStatus = isDone ? "completed" : prog > 0 ? "in_progress" : "not_started";
    return {
      courseId: a.courseId,
      courseTitle: a.course.title,
      status,
      progress: isDone ? 100 : prog,
      dueDate: a.dueDate?.toISOString() ?? null,
      assignedAt: a.assignedAt?.toISOString() ?? null,
    };
  });
}

async function getCreatorData(userId: string) {
  // Un créateur voit ses propres affectations + le scope de son/ses manager(s)
  const creatorTeams = await prisma.userTeam.findMany({
    where: { userId },
    include: { team: { select: { managerId: true } } },
  });
  const managerIds = [...new Set(
    creatorTeams.map((ut) => ut.team.managerId).filter(Boolean) as string[]
  )];

  // Données des managers (scope équipe)
  if (managerIds.length > 0) {
    const managerDataList = await Promise.all(managerIds.map((mId) => getManagerData(mId)));
    const validData = managerDataList.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getManagerData>>>[];

    if (validData.length > 0) {
      // Fusionner les données de tous les managers
      const courseMap = new Map<string, string>();
      const teamMap = new Map<string, string>();
      const userMap = new Map<string, UserProgressRow>();

      for (const d of validData) {
        d.courses.forEach((c) => courseMap.set(c.id, c.title));
        d.teams.forEach((t) => teamMap.set(t.id, t.name));
        d.users.forEach((u) => { if (!userMap.has(u.id)) userMap.set(u.id, u); });
      }

      // Ajouter aussi les affectations directes du créateur non encore présentes
      const directAssignments = await prisma.courseAssignment.findMany({
        where: { assignedById: userId },
        include: { user: { select: USER_SELECT }, course: { select: { id: true, title: true } } },
      });
      for (const a of directAssignments) {
        courseMap.set(a.courseId, a.course.title);
        if (!userMap.has(a.user.id)) userMap.set(a.user.id, buildUserRow(a.user));
      }

      const courses = [...courseMap.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
      const teams   = [...teamMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
      const users   = [...userMap.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      return { courses, teams, users };
    }
  }

  // Pas de manager : fallback sur les affectations directes du créateur uniquement
  const assignments = await prisma.courseAssignment.findMany({
    where: { assignedById: userId },
    include: {
      user: { select: USER_SELECT },
      course: { select: { id: true, title: true } },
    },
  });
  if (assignments.length === 0) return null;

  const courseMap = new Map(assignments.map((a) => [a.courseId, a.course.title]));
  const courses = [...courseMap.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));

  const teamMap = new Map<string, string>();
  for (const a of assignments) {
    for (const ut of a.user.teams) teamMap.set(ut.team.id, ut.team.name);
  }
  const teams = [...teamMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const seenIds = new Set<string>();
  const users: UserProgressRow[] = [];
  for (const a of assignments) {
    if (!seenIds.has(a.user.id)) { seenIds.add(a.user.id); users.push(buildUserRow(a.user)); }
  }
  users.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return { courses, teams, users };
}

export default async function ManagerProgressPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Admin → rediriger vers la page admin complète
  if (session.user.sessionMode === "admin") redirect("/dashboard/admin/progress");

  // Vérifier rôle manager ou creator
  const roleRecord = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
  });
  if (!roleRecord) redirect("/dashboard");

  const isManager = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: "manager" } },
  }) !== null;

  // Manager → scope équipe (via assigningTeamId) + ses propres affectations directes
  // Créateur → scope ses propres affectations uniquement
  const [data, myAssignments] = await Promise.all([
    isManager ? getManagerData(session.user.id) : getCreatorData(session.user.id),
    getMyProgress(session.user.id),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "";
  const t = await getTranslations("progress");

  const title = isManager ? t("myTeamProgress") : t("myAssignmentsProgress");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{title}</h1>
        {firstName && (
          <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{firstName}</p>
        )}
      </div>
      <ProgressTabs
        myAssignments={myAssignments}
        generalData={data}
        isManager={isManager}
        labelMine={t("tabMine")}
        labelGeneral={t("tabGeneral")}
      />
    </div>
  );
}
