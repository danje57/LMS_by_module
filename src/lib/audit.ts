import { prisma } from "@/lib/prisma";

export interface AuditActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface AuditParams {
  actor: AuditActor;
  action: string;
  targetId?: string | null;
  targetLabel?: string | null;
  details?: Record<string, unknown> | null;
}

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId:     params.actor.id     ?? null,
        actorName:   params.actor.name   ?? null,
        actorEmail:  params.actor.email  ?? null,
        action:      params.action,
        targetId:    params.targetId     ?? null,
        targetLabel: params.targetLabel  ?? null,
        details:     (params.details ?? undefined) as Parameters<typeof prisma.auditLog.create>[0]["data"]["details"],
      },
    });
  } catch {
    // L'audit ne doit jamais faire échouer l'opération principale
  }
}
