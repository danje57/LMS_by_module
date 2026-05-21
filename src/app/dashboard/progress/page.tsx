import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "@/components/admin/progress-client";
import type { UserProgressRow, CourseStatus } from "@/components/admin/progress-client";
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

async function getCreatorData(userId: string) {
  // Un créateur voit uniquement les affectations qu'il a personnellement créées
  const assignments = await prisma.courseAssignment.findMany({
    where: { assignedById: userId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true,
          teams: { include: { team: { select: { id: true, name: true } } } },
          courseProgress: { select: { courseId: true, progress: true } },
          certificates: { select: { courseId: true } },
        },
      },
      course: { select: { id: true, title: true } },
    },
  });

  if (assignments.length === 0) return null;

  // Cours visibles
  const courseMap = new Map(assignments.map((a) => [a.courseId, a.course.title]));
  const courses = [...courseMap.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // Teams présentes parmi les apprenants assignés
  const teamMap = new Map<string, string>();
  for (const a of assignments) {
    for (const ut of a.user.teams) teamMap.set(ut.team.id, ut.team.name);
  }
  const teams = [...teamMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // Dédupliquer les apprenants
  const seenIds = new Set<string>();
  const rawUsers: typeof assignments[number]["user"][] = [];
  for (const a of assignments) {
    if (!seenIds.has(a.user.id)) { seenIds.add(a.user.id); rawUsers.push(a.user); }
  }

  // Pour chaque apprenant, ne garder que les cours que ce créateur lui a assignés
  const assignedByCourseMap = new Map<string, Set<string>>(); // userId → courseIds
  for (const a of assignments) {
    if (!assignedByCourseMap.has(a.userId)) assignedByCourseMap.set(a.userId, new Set());
    assignedByCourseMap.get(a.userId)!.add(a.courseId);
  }

  const users: UserProgressRow[] = rawUsers
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map((u) => {
      const progressMap = new Map(u.courseProgress.map((p) => [p.courseId, p.progress]));
      const certSet = new Set(u.certificates.map((c) => c.courseId).filter(Boolean) as string[]);
      const myCourseIds = assignedByCourseMap.get(u.id) ?? new Set();
      return {
        id: u.id, name: u.name, email: u.email,
        teams: u.teams.map((ut) => ({ id: ut.team.id, name: ut.team.name })),
        assignments: [...myCourseIds].map((courseId) => {
          const isDone = certSet.has(courseId);
          const prog = progressMap.get(courseId) ?? 0;
          const status: CourseStatus = isDone ? "completed" : prog > 0 ? "in_progress" : "not_started";
          // dueDate from the creator's own assignment record
        const assignmentRecord = assignments.find((a) => a.userId === u.id && a.courseId === courseId);
        return {
          courseId,
          courseTitle: courseMap.get(courseId) ?? courseId,
          status,
          progress: isDone ? 100 : prog,
          dueDate: assignmentRecord?.dueDate?.toISOString() ?? null,
          assignedAt: assignmentRecord?.assignedAt?.toISOString() ?? null,
        };
        }),
      };
    });

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
  const data = isManager
    ? await getManagerData(session.user.id)
    : await getCreatorData(session.user.id);

  const firstName = session.user.name?.split(" ")[0] ?? "";

  const t = await getTranslations("progress");

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">
            {isManager ? t("myTeamProgress") : t("myAssignmentsProgress")}
          </h1>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-12 flex flex-col items-center gap-3 text-center">
          <p className="text-[14px] text-[#6E6E73]">
            {isManager ? t("noTeamNoAssignments") : t("noAssignments")}
          </p>
        </div>
      </div>
    );
  }

  const subtitle = isManager
    ? t("teams", { s: data.teams.length > 1 ? "s" : "", teams: data.teams.map((t) => t.name).join(", ") })
    : t("learnerProgressOnAssignments");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">
          {isManager ? t("myTeamProgress") : t("myAssignmentsProgress")}
        </h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {firstName ? `${firstName} · ` : ""}{subtitle}
        </p>
      </div>
      <ProgressClient courses={data.courses} teams={data.teams} users={data.users} />
    </div>
  );
}
