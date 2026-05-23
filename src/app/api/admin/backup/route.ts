import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBackup } from "@/lib/backup";
import { auditLog } from "@/lib/audit";

// GET — liste des backups
export async function GET() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const records = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes?.toString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    notes: r.notes,
  })));
}

// POST — créer un backup manuel
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const notes = (body as { notes?: string }).notes ?? null;

  try {
    const result = await createBackup({
      notes: notes ?? undefined,
      createdBy: session.user.name ?? session.user.email,
    });
    await auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "backup.create",
      targetLabel: result.filename,
      details: { sizeBytes: result.sizeBytes },
    });
    return NextResponse.json({ ok: true, id: result.id, filename: result.filename, sizeBytes: result.sizeBytes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
