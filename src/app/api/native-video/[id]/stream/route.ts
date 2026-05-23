import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const nativeVideo = await prisma.nativeVideo.findUnique({ where: { id } });
  if (!nativeVideo) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });

  const filePath = path.join(UPLOAD_DIR, nativeVideo.videoPath);
  let stat: ReturnType<typeof statSync>;
  try { stat = statSync(filePath); } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const ext = path.extname(nativeVideo.videoPath).toLowerCase();
  const mimeMap: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
  const contentType = mimeMap[ext] ?? "video/mp4";

  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;
    const chunkSize = end - start + 1;

    const webStream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}
