import { LoginForm } from "@/components/auth/login-form";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { GraduationCap } from "lucide-react";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function LoginPage() {
  const branding = await getBranding();

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / App name */}
        <div className="flex flex-col items-center mb-10">
          {branding?.logoPath ? (
            <Image
              src={`/api/assets/${branding.logoPath}`}
              alt={branding.appName}
              width={64}
              height={64}
              className="object-contain mb-4"
            />
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

        {/* Card */}
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
