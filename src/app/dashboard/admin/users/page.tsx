import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserList } from "@/components/admin/user-list";

async function getData() {
  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { roles: { include: { role: true } } },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, managerId: true },
    }),
  ]);
  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      roles: u.roles.map((ur) => ur.role.name),
    })),
    teams,
  };
}

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const { users, teams } = await getData();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Utilisateurs</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {users.length} utilisateur{users.length !== 1 ? "s" : ""}
        </p>
      </div>
      <UserList initialUsers={users} currentUserId={session.user.id} teams={teams} />
    </div>
  );
}
