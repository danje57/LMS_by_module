import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuditClient } from "@/components/admin/audit-client";

export default async function AuditPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const entries = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    actorName: l.actorName,
    actorEmail: l.actorEmail,
    action: l.action,
    targetLabel: l.targetLabel,
    details: l.details as Record<string, unknown> | null,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
        Journal d'audit
      </h1>
      <AuditClient entries={entries} />
    </div>
  );
}
