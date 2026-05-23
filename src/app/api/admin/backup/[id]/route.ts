import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBackupRecord } from "@/lib/backup";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Backup introuvable" }, { status: 404 });

  await deleteBackupRecord(id);
  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "backup.delete",
    targetLabel: record.filename,
  });

  return NextResponse.json({ ok: true });
}
