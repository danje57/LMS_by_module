import { PrismaClient, RoleType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Création des rôles
  for (const name of [RoleType.admin, RoleType.creator, RoleType.employee]) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Compte admin par défaut
  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@lms.local" },
    update: {},
    create: {
      email: "admin@lms.local",
      name: "Administrateur",
      passwordHash,
      authAccounts: {
        create: {
          provider: "local",
          providerAccountId: "admin@lms.local",
        },
      },
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleType.admin },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // Branding par défaut
  const existingBranding = await prisma.brandingSetting.findFirst();
  if (!existingBranding) {
    await prisma.brandingSetting.create({
      data: { appName: "LMS" },
    });
  }

  console.log("Seed terminé — admin@lms.local / Admin@123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
