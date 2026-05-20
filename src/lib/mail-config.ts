import { prisma } from "@/lib/prisma";
import type { MailSetting } from "@prisma/client";

export type MailConfig = {
  provider: "smtp" | "graph";
  fromName: string;
  appUrl: string | null;
  // SMTP
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
  // Graph
  graphTenantId: string | null;
  graphClientId: string | null;
  graphClientSecret: string | null;
  graphFrom: string | null;
  // Cron
  cronSecret: string | null;
};

// Priorité : DB → variables d'environnement
export async function getMailConfig(): Promise<MailConfig> {
  const db = await prisma.mailSetting.findFirst();
  return mergeWithEnv(db);
}

function mergeWithEnv(db: MailSetting | null): MailConfig {
  const providerRaw = db?.provider ?? process.env.MAIL_PROVIDER ?? "smtp";
  return {
    provider: providerRaw === "graph" ? "graph" : "smtp",
    fromName: db?.fromName || process.env.MAIL_FROM_NAME || "LMS Notifications",
    appUrl: db?.appUrl || process.env.APP_URL || null,
    smtpHost: db?.smtpHost || process.env.MAIL_HOST || null,
    smtpPort: db?.smtpPort ?? Number(process.env.MAIL_PORT ?? 587),
    smtpSecure: db?.smtpSecure ?? process.env.MAIL_SECURE === "true",
    smtpUser: db?.smtpUser || process.env.MAIL_USER || null,
    smtpPass: db?.smtpPass || process.env.MAIL_PASS || null,
    smtpFrom: db?.smtpFrom || process.env.MAIL_FROM || null,
    graphTenantId: db?.graphTenantId || process.env.MAIL_GRAPH_TENANT_ID || null,
    graphClientId: db?.graphClientId || process.env.MAIL_GRAPH_CLIENT_ID || null,
    graphClientSecret: db?.graphClientSecret || process.env.MAIL_GRAPH_CLIENT_SECRET || null,
    graphFrom: db?.graphFrom || process.env.MAIL_GRAPH_FROM || null,
    cronSecret: db?.cronSecret || process.env.CRON_SECRET || null,
  };
}

export function isConfigured(cfg: MailConfig): boolean {
  if (cfg.provider === "graph") {
    return !!(cfg.graphTenantId && cfg.graphClientId && cfg.graphClientSecret && cfg.graphFrom);
  }
  return !!(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass && cfg.smtpFrom);
}
