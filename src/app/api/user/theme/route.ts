import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { theme } = await req.json();
  if (!["light", "dark", "system"].includes(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  });

  await updateSession({ theme } as Parameters<typeof updateSession>[0]);

  return NextResponse.json({ ok: true });
}
