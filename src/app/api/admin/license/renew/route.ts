import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyLicenseToken, activateLicense } from "@/lib/license-verify";
import { createBackup } from "@/lib/backup";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const roles = session.user.roles as unknown as string[] | undefined;
  const isAdmin = session.user.sessionMode === "admin" || roles?.includes("admin") || roles?.includes("superadmin");
  if (!isAdmin) return NextResponse.json({ error: "Droits admin requis" }, { status: 403 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  // Vérifier le token avant tout
  const check = verifyLicenseToken(token);
  if (!check.valid) return NextResponse.json({ error: check.error ?? "Token invalide" }, { status: 400 });
  if (check.expired) return NextResponse.json({ error: "Cette licence est déjà expirée" }, { status: 400 });

  const config = await prisma.instanceConfig.findFirst();
  if (!config) return NextResponse.json({ error: "Instance non initialisée" }, { status: 500 });

  const licenseValid = config.licenseExpiresAt ? config.licenseExpiresAt > new Date() : !!config.licenseId;

  // Passer en mode grâce (grace period) pour que l'app reste accessible pendant le process
  await prisma.instanceConfig.update({
    where: { id: config.id },
    data: { renewalInProgress: true },
  });

  // Timeout de sécurité : reset renewalInProgress après 30 min si le process ne se termine pas
  setTimeout(async () => {
    try {
      const current = await prisma.instanceConfig.findFirst();
      if (current?.renewalInProgress) {
        await prisma.instanceConfig.update({
          where: { id: current.id },
          data: { renewalInProgress: false },
        });
      }
    } catch { /* ignore */ }
  }, 30 * 60 * 1000);

  try {
    // Backup obligatoire si licence encore valide, tenté mais non bloquant si expirée
    let backupOk = false;
    try {
      await createBackup({ createdBy: session.user.id, notes: "Backup automatique avant renouvellement licence" });
      backupOk = true;
    } catch (backupErr) {
      if (licenseValid) {
        // Licence valide → backup obligatoire
        await prisma.instanceConfig.update({ where: { id: config.id }, data: { renewalInProgress: false } });
        return NextResponse.json({
          error: "Le backup pré-renouvellement a échoué. Renouvellement annulé pour sécurité.",
          backupError: backupErr instanceof Error ? backupErr.message : String(backupErr),
        }, { status: 500 });
      }
      // Licence expirée → on continue avec avertissement
    }

    // Activation de la nouvelle licence (transaction atomique)
    const result = await activateLicense(token);
    if (!result.ok) {
      await prisma.instanceConfig.update({ where: { id: config.id }, data: { renewalInProgress: false } });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLog({
      actor: { id: session.user.id, name: session.user.name, email: session.user.email },
      action: "license.renew",
      targetLabel: `Renouvellement licence → ${check.payload?.company}`,
    });

    const res = NextResponse.json({ ok: true, backupOk });
    const expires = check.payload?.expiresAt
      ? new Date(check.payload.expiresAt)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    res.cookies.set("lms-lic", "1", { expires, path: "/", httpOnly: true, sameSite: "lax" });
    return res;

  } catch (err) {
    // En cas d'erreur inattendue, reset le flag
    await prisma.instanceConfig.update({ where: { id: config.id }, data: { renewalInProgress: false } }).catch(() => {});
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur inconnue" }, { status: 500 });
  }
}
