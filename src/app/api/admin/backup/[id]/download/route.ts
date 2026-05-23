import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Backup introuvable" }, { status: 404 });
  if (!fs.existsSync(record.filePath))
    return NextResponse.json({ error: "Fichier backup introuvable sur le serveur" }, { status: 404 });

  const buffer = fs.readFileSync(record.filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${record.filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
