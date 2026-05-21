import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locale } = await req.json();
  if (!["fr", "en"].includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
  });

  await updateSession({ locale } as Parameters<typeof updateSession>[0]);

  return NextResponse.json({ ok: true });
}
