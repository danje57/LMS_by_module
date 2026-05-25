import { prisma } from "@/lib/prisma";

export type DocumentScope =
  | { type: "admin" }
  | { type: "manager"; authorizedIds: string[] }  // manager + ses creators
  | { type: "creator"; authorizedIds: string[] };  // creator seul

/**
 * Retourne le scope de visibilité pour les documents PDF.
 * authorizedIds = IDs des utilisateurs dont les docs/assignments sont visibles.
 */
export async function getDocumentScope(
  userId: string,
  sessionMode: string | null
): Promise<DocumentScope | null> {
  if (sessionMode === "admin") return { type: "admin" };

  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  const roleNames = roles.map((r) => r.role.name);

  if (roleNames.includes("manager")) {
    // Manager voit ses propres docs + docs de ses creators (membres de ses équipes ayant le rôle creator)
    const creatorMembers = await prisma.userTeam.findMany({
      where: {
        team: { managerId: userId },
        user: { roles: { some: { role: { name: "creator" } } } },
      },
      select: { userId: true },
    });
    const authorizedIds = [userId, ...creatorMembers.map((m) => m.userId)];
    return { type: "manager", authorizedIds };
  }

  if (roleNames.includes("creator")) {
    return { type: "creator", authorizedIds: [userId] };
  }

  return null; // pas de droit
}

/** Filtre Prisma sur createdById selon le scope */
export function docWhereScope(scope: DocumentScope): object {
  if (scope.type === "admin") return {};
  return { createdById: { in: scope.authorizedIds } };
}

/** Filtre Prisma sur assignedById selon le scope */
export function assignmentWhereScope(scope: DocumentScope): object {
  if (scope.type === "admin") return {};
  return { assignedById: { in: scope.authorizedIds } };
}
