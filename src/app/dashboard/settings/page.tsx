import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandingForm } from "@/components/settings/branding-form";
import { MailSettingsForm } from "@/components/settings/mail-settings-form";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  const branding = await getBranding();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Paramètres</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          Personnalisation et configuration de l&apos;application
        </p>
      </div>
      <BrandingForm branding={branding} />
      <MailSettingsForm />
    </div>
  );
}
