import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionGuard } from "@/components/layout/session-guard";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { prisma } from "@/lib/prisma";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

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
