import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandingForm } from "@/components/settings/branding-form";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.roles.includes("admin")) redirect("/dashboard");

  const branding = await getBranding();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Personnalisation de l&apos;application
        </p>
      </div>
      <BrandingForm branding={branding} />
    </div>
  );
}
