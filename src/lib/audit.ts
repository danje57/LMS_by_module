import { prisma } from "@/lib/prisma";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";

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

const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR ?? "./logs/audit";

export function auditLogFile(params: AuditParams): void {
  try {
    mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(AUDIT_LOG_DIR, `audit-${date}.log`);
    const line = JSON.stringify({
      ts:          new Date().toISOString(),
      actor:       params.actor.email ?? params.actor.id ?? "unknown",
      actorName:   params.actor.name ?? null,
      action:      params.action,
      target:      params.targetLabel ?? params.targetId ?? null,
      details:     params.details ?? null,
    });
    appendFileSync(filePath, line + "\n", "utf8");
  } catch {
    // Ne jamais faire échouer l'opération principale
  }
}

export async function auditLog(params: AuditParams): Promise<void> {
  auditLogFile(params);
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
    // Ne jamais faire échouer l'opération principale
  }
}
