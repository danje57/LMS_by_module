import { LoginForm } from "@/components/auth/login-form";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

async function getBranding() {
  return prisma.brandingSetting.findFirst();
}

export default async function LoginPage() {
  const branding = await getBranding();

  return (
    <div className="min-h-screen flex">
      {/* Panneau gauche — bannière */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary">
        {branding?.bannerPath ? (
          <Image
            src={`/api/assets/${branding.bannerPath}`}
            alt="Bannière"
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full p-12 text-primary-foreground">
            <div className="text-5xl font-bold mb-4">
              {branding?.appName ?? "LMS"}
            </div>
            <p className="text-xl opacity-80 text-center max-w-sm">
              Plateforme de formation professionnelle
            </p>
          </div>
        )}
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {branding?.logoPath && (
            <div className="flex justify-center mb-8">
              <Image
                src={`/api/assets/${branding.logoPath}`}
                alt="Logo"
                width={120}
                height={60}
                className="object-contain"
              />
            </div>
          )}

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {branding?.appName ?? "LMS"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Connectez-vous à votre espace
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
