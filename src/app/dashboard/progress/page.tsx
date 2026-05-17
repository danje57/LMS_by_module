import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "@/components/admin/progress-client";
import type { UserProgressRow, CourseStatus } from "@/components/admin/progress-client";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  teams: { include: { team: { select: { id: true, name: true } } } },
  assignments: { include: { course: { select: { id: true, title: true } } } },
  courseProgress: { select: { courseId: true, progress: true } },
  certificates: { select: { courseId: true } },
} as const;

function buildUserRow(u: {
  id: string;
  name: string | null;
  email: string;
  teams: { team: { id: string; name: string } }[];
  assignments: { courseId: string; course: { id: string; title: string } }[];
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
      return { courseId: a.courseId, courseTitle: a.course.title, status, progress: isDone ? 100 : prog };
    }),
  };
}

async function getManagerData(userId: string) {
  // Équipes gérées + utilisateurs à qui ce manager a affecté des cours (hors équipe)
  const [managedTeams, assignedByManager] = await Promise.all([
    prisma.team.findMany({
      where: { managerId: userId },
      select: { id: true, name: true, members: { include: { user: { select: USER_SELECT } } } },
    }),
    prisma.courseAssignment.findMany({
      where: { assignedById: userId },
      include: { user: { select: USER_SELECT } },
    }),
  ]);

  const hasScope = managedTeams.length > 0 || assignedByManager.length > 0;
  if (!hasScope) return null;

  const teams = managedTeams.map((t) => ({ id: t.id, name: t.name }));

  // Union des utilisateurs : membres d'équipe + utilisateurs assignés
  const seenIds = new Set<string>();
  const rawUsers: typeof assignedByManager[number]["user"][] = [];

  for (const t of managedTeams) {
    for (const m of t.members) {
      if (!seenIds.has(m.user.id)) { seenIds.add(m.user.id); rawUsers.push(m.user); }
    }
  }
  for (const a of assignedByManager) {
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

export default async function ManagerProgressPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Admin → rediriger vers la page admin complète
  if (session.user.sessionMode === "admin") redirect("/dashboard/admin/progress");

  // Vérifier le rôle manager
  const isManager = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: "manager" } },
  });
  if (!isManager) redirect("/dashboard");

  const data = await getManagerData(session.user.id);

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Suivi de mon équipe</h1>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-12 flex flex-col items-center gap-3 text-center">
          <p className="text-[15px] font-medium text-[#1D1D1F]">Vous n&apos;êtes manager d&apos;aucune équipe</p>
          <p className="text-[13px] text-[#6E6E73]">Contactez un administrateur pour être assigné à une équipe.</p>
        </div>
      </div>
    );
  }

  const firstName = session.user.name?.split(" ")[0] ?? "";
  const teamNames = data.teams.map((t) => t.name).join(", ");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Suivi de mon équipe</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {firstName ? `${firstName} · ` : ""}Équipe{data.teams.length > 1 ? "s" : ""} : {teamNames}
        </p>
      </div>
      <ProgressClient courses={data.courses} teams={data.teams} users={data.users} />
    </div>
  );
}
