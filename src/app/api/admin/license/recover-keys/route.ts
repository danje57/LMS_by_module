import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstanceKeys } from "@/lib/instance-crypto";
import { resolveAllContentKeys, decryptWithContentKey } from "@/lib/license-verify";
import { constants, publicEncrypt } from "crypto";
import { auditLog } from "@/lib/audit";

// POST — re-enveloppe toutes les clés de contenu avec la nouvelle clé RSA (après réinstallation)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const roles = session.user.roles as unknown as string[] | undefined;
  const isAdmin = session.user.sessionMode === "admin" || roles?.includes("admin") || roles?.includes("superadmin");
  if (!isAdmin) return NextResponse.json({ error: "Droits admin requis" }, { status: 403 });

  const { publicKey } = await getInstanceKeys();
  const results = { courses: 0, videos: 0, errors: 0 };

  // Récupère TOUTES les clés de contenu possibles (courante + chaîne historique)
  const allContentKeys = await resolveAllContentKeys();
  if (allContentKeys.length === 0) {
    return NextResponse.json({ ok: false, error: "Aucune clé de contenu disponible" }, { status: 400 });
  }

  // Tente de déchiffrer licenseEncryptedKey avec chaque clé jusqu'à réussite
  const tryDecryptFileKey = (licenseEncryptedKey: string): string | null => {
    for (const ck of allContentKeys) {
      try {
        const hex = decryptWithContentKey(licenseEncryptedKey, ck);
        if (/^[0-9a-f]{64}$/i.test(hex)) return hex;
      } catch { /* essai suivant */ }
    }
    return null;
  };

  // Re-enveloppe les cours (H5P + PDF)
  const courses = await prisma.course.findMany({
    where: { isEncrypted: true, licenseEncryptedKey: { not: null }, contentLicenseId: { not: null } },
    select: { id: true, licenseEncryptedKey: true, contentLicenseId: true },
  });

  for (const course of courses) {
    try {
      const fileKeyHex = tryDecryptFileKey(course.licenseEncryptedKey!);
      if (!fileKeyHex) { results.errors++; continue; }
      const newEncryptedKey = publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(fileKeyHex, "hex")
      ).toString("base64");
      await prisma.course.update({ where: { id: course.id }, data: { encryptedKey: newEncryptedKey } });
      results.courses++;
    } catch { results.errors++; }
  }

  // Re-enveloppe les vidéos natives
  const videos = await prisma.nativeVideo.findMany({
    where: { isEncrypted: true, licenseEncryptedKey: { not: null }, contentLicenseId: { not: null } },
    select: { id: true, licenseEncryptedKey: true, contentLicenseId: true },
  });

  for (const video of videos) {
    try {
      const fileKeyHex = tryDecryptFileKey(video.licenseEncryptedKey!);
      if (!fileKeyHex) { results.errors++; continue; }
      const newEncryptedKey = publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(fileKeyHex, "hex")
      ).toString("base64");
      await prisma.nativeVideo.update({ where: { id: video.id }, data: { encryptedKey: newEncryptedKey } });
      results.videos++;
    } catch { results.errors++; }
  }

  await auditLog({
    actor: { id: session.user.id, name: session.user.name, email: session.user.email },
    action: "license.recover-keys",
    targetLabel: `Récupération clés: ${results.courses} cours, ${results.videos} vidéos, ${results.errors} erreurs`,
  });

  return NextResponse.json({ ok: true, ...results });
}

// GET — vérifie si une récupération est nécessaire (contenu sans accès valide)
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const rolesGet = session.user.roles as unknown as string[] | undefined;
  const isAdminGet = session.user.sessionMode === "admin" || rolesGet?.includes("admin") || rolesGet?.includes("superadmin");
  if (!isAdminGet) return NextResponse.json({ error: "Droits admin requis" }, { status: 403 });

  const [courses, videos] = await Promise.all([
    prisma.course.count({
      where: { isEncrypted: true, licenseEncryptedKey: { not: null } },
    }),
    prisma.nativeVideo.count({
      where: { isEncrypted: true, licenseEncryptedKey: { not: null } },
    }),
  ]);

  return NextResponse.json({ recoverableContent: courses + videos });
}
