import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionGuard } from "@/components/layout/session-guard";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { LicenseExpiryBanner } from "@/components/layout/license-expiry-banner";
import { prisma } from "@/lib/prisma";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getCurrentLicense } from "@/lib/license-verify";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Vérification licence — bloque l'app sauf si renouvellement en cours (grace period)
  const license = await getCurrentLicense();
  const renewalInProgress = license?.renewalInProgress ?? false;
  if (!renewalInProgress) {
    const roles = session.user.roles as unknown as string[] | undefined;
    const isAdminRole = session.user.sessionMode === "admin"
      || roles?.includes("admin")
      || roles?.includes("superadmin")
      || false;
    if (!license) {
      redirect(isAdminRole ? "/activate" : "/not-activated");
    }
    const expired = license.licenseExpiresAt ? new Date(license.licenseExpiresAt) < new Date() : false;
    if (expired) redirect(isAdminRole ? "/activate" : "/not-activated");
  }

  const licenseExpiryDaysLeft = (() => {
    if (!license?.licenseExpiresAt) return null;
    const diff = Math.ceil((new Date(license.licenseExpiresAt).getTime() - Date.now()) / 86400000);
    return diff > 0 && diff < 30 ? diff : null;
  })();

  const roles = session.user.roles as unknown as string[] | undefined;
  const isAdminRole = session.user.sessionMode === "admin"
    || roles?.includes("admin")
    || roles?.includes("superadmin")
    || false;

  if (isAdminRole && licenseExpiryDaysLeft !== null) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.notification.findFirst({
      where: { userId: session.user.id, type: "license_expiry_warning", createdAt: { gt: yesterday } },
    }).then(existing => {
      if (!existing) {
        prisma.notification.create({
          data: {
            userId:  session.user.id,
            type:    "license_expiry_warning",
            title:   "Licence bientôt expirée",
            message: `Votre licence expire dans ${licenseExpiryDaysLeft} jour${licenseExpiryDaysLeft > 1 ? "s" : ""}. Renouvelez-la pour maintenir l'accès.`,
            link:    "/dashboard/admin/license",
          },
        }).catch(() => {});
        auditLog({
          actor:       { id: session.user.id, name: session.user.name, email: session.user.email },
          action:      "license.expiry_warning",
          targetLabel: `Licence expire dans ${licenseExpiryDaysLeft} jour${licenseExpiryDaysLeft > 1 ? "s" : ""}`,
          details:     { daysLeft: licenseExpiryDaysLeft },
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  const isAdmin = session.user.sessionMode === "admin";

  const [branding, managerRole, strictManagerRole, messages] = await Promise.all([
    getBranding(),
    isAdmin
      ? Promise.resolve(null)
      : prisma.userRole.findFirst({
          where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
        }),
    isAdmin
      ? Promise.resolve(null)
      : prisma.userRole.findFirst({
          where: { userId: session.user.id, role: { name: "manager" } },
        }),
    getMessages(),
  ]);

  const isManager = !isAdmin && managerRole !== null; // true pour manager ET créateur
  const isStrictManager = !isAdmin && strictManagerRole !== null; // true pour manager uniquement

  return (
    <NextIntlClientProvider messages={messages}>
    <div className="flex h-screen bg-[#F5F5F7] dark:bg-[#0A0A0F]">
      <Sidebar
        appName={branding?.appName ?? "LMS"}
        logoPath={branding?.logoPath ? `/api/assets/${branding.logoPath}` : null}
        isAdmin={isAdmin}
        isManager={isManager}
        isStrictManager={isStrictManager}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header session={session} />
        <SessionGuard userId={session.user.id} />
        {isAdmin && licenseExpiryDaysLeft !== null && (
          <LicenseExpiryBanner daysLeft={licenseExpiryDaysLeft} />
        )}
        <MaintenanceBanner
          enabled={branding?.maintenanceBannerEnabled ?? false}
          message={branding?.maintenanceBannerMessage ?? null}
          color={branding?.maintenanceBannerColor ?? "orange"}
          endsAt={branding?.maintenanceBannerEndsAt ?? null}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </NextIntlClientProvider>
  );
}
