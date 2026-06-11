import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandingForm } from "@/components/settings/branding-form";
import { MailSettingsForm } from "@/components/settings/mail-settings-form";
import { BackupManager } from "@/components/settings/backup-manager";
import { RetentionSettingsForm } from "@/components/settings/retention-settings-form";
import { SeasonalThemeToggle } from "@/components/settings/seasonal-theme-toggle";
import { MaintenanceBannerForm } from "@/components/settings/maintenance-banner-form";
import { EncryptMigratePanel } from "@/components/settings/encrypt-migrate-panel";
import { LicenseSettingsPanel } from "@/components/settings/license-settings-panel";
import { SettingsNav } from "@/components/settings/settings-nav";
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

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const cronUrl = `${proto}://${host}/api/cron/backup`;

  return (
    <div className="flex gap-8 items-start">

      {/* Nav gauche */}
      <SettingsNav />

      {/* Sections + en-tête */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">

        {/* En-tête */}
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{tNav("settings")}</h1>
          <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{t("subtitle")}</p>
        </div>

          <div id="personnalisation" className="scroll-mt-6">
            <BrandingForm branding={branding} />
          </div>

          <div id="email" className="scroll-mt-6">
            <MailSettingsForm />
          </div>

          <div id="retention" className="scroll-mt-6">
            <RetentionSettingsForm current={branding?.auditLogRetentionDays ?? 180} />
          </div>

          <div id="themes" className="scroll-mt-6">
            <SeasonalThemeToggle current={branding?.seasonalThemesEnabled ?? false} />
          </div>

          <div id="maintenance" className="scroll-mt-6">
            <MaintenanceBannerForm current={{
              enabled: branding?.maintenanceBannerEnabled ?? false,
              message: branding?.maintenanceBannerMessage ?? null,
              color: branding?.maintenanceBannerColor ?? "orange",
              endsAt: branding?.maintenanceBannerEndsAt?.toISOString() ?? null,
            }} />
          </div>

          <div id="chiffrement" className="scroll-mt-6">
            <EncryptMigratePanel />
          </div>

          <div id="licence" className="scroll-mt-6">
            <LicenseSettingsPanel />
          </div>

          <div id="backup" className="scroll-mt-6">
            <BackupManager initialBackups={backups} cronUrl={cronUrl} />
          </div>

        </div>
      </div>
  );
}

