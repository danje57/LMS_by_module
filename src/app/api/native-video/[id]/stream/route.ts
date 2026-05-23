import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReadStream, statSync } from "fs";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const nativeVideo = await prisma.nativeVideo.findUnique({ where: { id } });
  if (!nativeVideo) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });

  const filePath = path.join(process.cwd(), "uploads", nativeVideo.videoPath);
  let stat: ReturnType<typeof statSync>;
  try { stat = statSync(filePath); } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const ext = path.extname(nativeVideo.videoPath).toLowerCase();
  const mimeMap: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
  const contentType = mimeMap[ext] ?? "video/mp4";

  const range = req.headers.get("range");
  const fileSize = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });
    const nodeStream = stream as unknown as ReadableStream;

    return new NextResponse(nodeStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = createReadStream(filePath) as unknown as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}
