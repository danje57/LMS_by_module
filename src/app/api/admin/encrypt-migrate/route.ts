import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { encryptBuffer, encryptVideoBuffer, signManifest } from "@/lib/instance-crypto";
import { buildLicenseEnvelope } from "@/lib/license-verify";
import { existsSync } from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.sessionMode !== "admin") return NextResponse.json({ error: "Mode admin requis" }, { status: 403 });

  const results = { courses: 0, documents: 0, videos: 0, errors: 0 };

  // --- Cours H5P non chiffrés ---
  const courses = await prisma.course.findMany({
    where: { isEncrypted: false, courseType: "h5p", isActive: true },
    select: { id: true, filePath: true, fileHash: true, createdById: true, createdAt: true },
  });

  for (const course of courses) {
    const absPath = path.join(UPLOAD_DIR, course.filePath);
    if (!existsSync(absPath)) { results.errors++; continue; }
    try {
      const plain = await readFile(absPath);
      const { encrypted, encryptedKey, fileKeyHex } = await encryptBuffer(plain);
      await writeFile(absPath, encrypted);
      const manifest = await signManifest({
        courseId: course.id,
        contentHash: course.fileHash ?? "",
        createdBy: course.createdById,
        createdAt: course.createdAt.toISOString(),
        instanceId: "",
      });
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      await prisma.course.update({
        where: { id: course.id },
        data: {
          isEncrypted: true, encryptedKey, contentManifest: manifest,
          ...(envelope ? { licenseEncryptedKey: envelope.licenseEncryptedKey, contentLicenseId: envelope.contentLicenseId } : {}),
        },
      });
      results.courses++;
    } catch { results.errors++; }
  }

  // --- Documents GRC (PDF) non chiffrés ---
  const docs = await prisma.course.findMany({
    where: { isEncrypted: false, courseType: "pdf", isActive: true },
    select: { id: true, filePath: true, fileHash: true, createdById: true, createdAt: true },
  });

  for (const doc of docs) {
    const absPath = path.join(UPLOAD_DIR, doc.filePath);
    if (!existsSync(absPath)) { results.errors++; continue; }
    try {
      const plain = await readFile(absPath);
      const { encrypted, encryptedKey, fileKeyHex } = await encryptBuffer(plain);
      await writeFile(absPath, encrypted);
      const manifest = await signManifest({
        courseId: doc.id,
        contentHash: doc.fileHash ?? "",
        createdBy: doc.createdById,
        createdAt: doc.createdAt.toISOString(),
        instanceId: "",
      });
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      await prisma.course.update({
        where: { id: doc.id },
        data: {
          isEncrypted: true, encryptedKey, contentManifest: manifest,
          ...(envelope ? { licenseEncryptedKey: envelope.licenseEncryptedKey, contentLicenseId: envelope.contentLicenseId } : {}),
        },
      });
      results.documents++;
    } catch { results.errors++; }
  }

  // --- Vidéos natives non chiffrées ---
  const videos = await prisma.nativeVideo.findMany({
    where: { isEncrypted: false },
    select: { id: true, videoPath: true },
  });

  for (const video of videos) {
    const absPath = path.join(UPLOAD_DIR, video.videoPath);
    if (!existsSync(absPath)) { results.errors++; continue; }
    try {
      const plain = await readFile(absPath);
      const { encrypted, encryptedKey, fileKeyHex } = await encryptVideoBuffer(plain);
      await writeFile(absPath, encrypted);
      const envelope = await buildLicenseEnvelope(fileKeyHex);
      await prisma.nativeVideo.update({
        where: { id: video.id },
        data: {
          isEncrypted: true, encryptedKey,
          ...(envelope ? { licenseEncryptedKey: envelope.licenseEncryptedKey, contentLicenseId: envelope.contentLicenseId } : {}),
        },
      });
      results.videos++;
    } catch { results.errors++; }
  }

  return NextResponse.json({ ok: true, ...results });
}

// GET — état de la migration (combien de fichiers non chiffrés restent)
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.sessionMode !== "admin") return NextResponse.json({ error: "Mode admin requis" }, { status: 403 });

  const [plainCourses, plainDocs, plainVideos, encCourses, encDocs, encVideos] = await Promise.all([
    prisma.course.count({ where: { isEncrypted: false, courseType: "h5p", isActive: true } }),
    prisma.course.count({ where: { isEncrypted: false, courseType: "pdf", isActive: true } }),
    prisma.nativeVideo.count({ where: { isEncrypted: false } }),
    prisma.course.count({ where: { isEncrypted: true, courseType: "h5p", isActive: true } }),
    prisma.course.count({ where: { isEncrypted: true, courseType: "pdf", isActive: true } }),
    prisma.nativeVideo.count({ where: { isEncrypted: true } }),
  ]);

  return NextResponse.json({
    pending: { courses: plainCourses, documents: plainDocs, videos: plainVideos },
    encrypted: { courses: encCourses, documents: encDocs, videos: encVideos },
  });
}
