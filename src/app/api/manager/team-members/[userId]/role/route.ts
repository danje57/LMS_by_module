import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { sendMail, isMailConfigured } from "@/lib/mail";
import { getMailConfig } from "@/lib/mail-config";
import { templateCreatorPromoted, templateCreatorDemoted } from "@/lib/mail-templates";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const callerId = session.user.id;
  const { userId: targetId } = await params;

  if (callerId === targetId)
    return NextResponse.json({ error: "Impossible de modifier ses propres rôles" }, { status: 400 });

  // Vérifier que l'appelant est bien manager (rôle strict, pas juste créateur)
  const callerManagerRole = await prisma.userRole.findFirst({
    where: { userId: callerId, role: { name: "manager" } },
  });
  if (!callerManagerRole)
    return NextResponse.json({ error: "Réservé aux managers" }, { status: 403 });

  // Vérifier que la cible est membre d'une des équipes gérées par l'appelant
  const membership = await prisma.userTeam.findFirst({
    where: {
      userId: targetId,
      team: { managerId: callerId },
    },
  });
  if (!membership)
    return NextResponse.json({ error: "Cet utilisateur n'est pas dans vos équipes" }, { status: 403 });

  // Récupérer les rôles actuels de la cible
  const targetRoles = await prisma.userRole.findMany({
    where: { userId: targetId },
    include: { role: true },
  });
  const roleNames = targetRoles.map((r) => r.role.name);

  // Ne pas toucher aux managers (le rôle admin n'empêche pas la gestion du creator)
  if (roleNames.includes("manager"))
    return NextResponse.json({ error: "Impossible de modifier les rôles d'un manager" }, { status: 400 });

  const { action } = await req.json() as { action: "promote" | "demote" };
  if (action !== "promote" && action !== "demote")
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });

  const creatorRole = await prisma.role.findUnique({ where: { name: "creator" } });
  if (!creatorRole)
    return NextResponse.json({ error: "Rôle creator introuvable" }, { status: 500 });

  const alreadyCreator = roleNames.includes("creator");

  if (action === "promote") {
    if (!alreadyCreator) {
      await prisma.userRole.create({ data: { userId: targetId, roleId: creatorRole.id } });
    }
  } else {
    if (alreadyCreator) {
      await prisma.userRole.delete({
        where: { userId_roleId: { userId: targetId, roleId: creatorRole.id } },
      });
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: { email: true, name: true },
  });

  await auditLog({
    actor: { id: callerId, name: session.user.name, email: session.user.email },
    action: action === "promote" ? "manager.role.promote_creator" : "manager.role.demote_creator",
    targetId,
    targetLabel: targetUser?.email ?? targetId,
    details: { targetName: targetUser?.name },
  });

  // Notification mail (best-effort — ne bloque jamais l'action)
  if (targetUser && await isMailConfigured()) {
    const mailCfg = await getMailConfig();
    const branding = { appName: mailCfg.fromName, appUrl: mailCfg.appUrl ?? undefined };
    const userName = targetUser.name ?? targetUser.email;
    const managerName = session.user.name ?? session.user.email;
    const { subject, html } = action === "promote"
      ? templateCreatorPromoted({ branding, userName, managerName })
      : templateCreatorDemoted({ branding, userName, managerName });
    await sendMail({ to: targetUser.email, subject, html }).catch(() => null);
  }

  const updatedRoles = await prisma.userRole.findMany({
    where: { userId: targetId },
    include: { role: true },
  });

  return NextResponse.json({ roles: updatedRoles.map((r) => r.role.name) });
}
