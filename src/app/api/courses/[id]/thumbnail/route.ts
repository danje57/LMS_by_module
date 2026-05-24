import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id }, select: { thumbnailPath: true } });
  if (!course?.thumbnailPath) return new NextResponse(null, { status: 404 });

  try {
    const data = await readFile(path.join(UPLOAD_DIR, course.thumbnailPath));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
