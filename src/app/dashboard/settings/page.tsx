import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandingForm } from "@/components/settings/branding-form";
import { MailSettingsForm } from "@/components/settings/mail-settings-form";
import { BackupManager } from "@/components/settings/backup-manager";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

async function getBackups() {
  const records = await prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" } });
  return records.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes?.toString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    notes: r.notes,
  }));
}

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const [branding, backups, t, tNav] = await Promise.all([
    getBranding(),
    getBackups(),
    getTranslations("settings"),
    getTranslations("nav"),
  ]);

  // Construire l'URL du cron backup à partir des headers de la requête
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const cronUrl = `${proto}://${host}/api/cron/backup`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{tNav("settings")}</h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {t("subtitle")}
        </p>
      </div>
      <BrandingForm branding={branding} />
      <MailSettingsForm />
      <BackupManager initialBackups={backups} cronUrl={cronUrl} />
    </div>
  );
}
