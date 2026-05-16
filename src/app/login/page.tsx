import { LoginForm } from "@/components/auth/login-form";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function LoginPage() {
  const branding = await getBranding();

  const logoUrl = branding?.logoPath
    ? `/api/public/assets/${branding.logoPath}`
    : null;
  const bannerUrl = branding?.bannerPath
    ? `/api/public/assets/${branding.bannerPath}`
    : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / App name */}
        <div className="flex flex-col items-center mb-10">
          {logoUrl ? (
            <div className="mb-4 w-20 h-20 relative">
              <Image
                src={logoUrl}
                alt={branding?.appName ?? "LMS"}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#0071E3] flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">
            {branding?.appName ?? "LMS"}
          </h1>
          <p className="text-[15px] text-[#6E6E73] mt-1">
            Connectez-vous à votre espace
          </p>
        </div>

        {/* Bannière optionnelle */}
        {bannerUrl && (
          <div className="relative w-full h-32 rounded-2xl overflow-hidden mb-6">
            <Image
              src={bannerUrl}
              alt="Bannière"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Card formulaire */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D2D2D7]/60 px-8 py-8">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-[#6E6E73] mt-6">
          Accès réservé aux utilisateurs autorisés
        </p>
      </div>
    </div>
  );
}
