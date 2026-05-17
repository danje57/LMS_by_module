import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";

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

  const branding = await getBranding();
  const isAdmin = session.user.sessionMode === "admin";

  return (
    <div className="flex h-screen bg-[#F5F5F7]">
      <Sidebar
        appName={branding?.appName ?? "LMS"}
        logoPath={branding?.logoPath ? `/api/assets/${branding.logoPath}` : null}
        isAdmin={isAdmin}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header session={session} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
