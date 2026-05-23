import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const adminRole = await prisma.role.findFirst({ where: { name: { in: ["superadmin", "admin"] } }, include: { users: { take: 1 } } });
  if (!adminRole || adminRole.users.length === 0) redirect("/setup");

  redirect("/login");
}
