import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Route publique — retourne les infos de branding sans authentification
// Utilisée par la page de login
export async function GET() {
  const branding = await prisma.brandingSetting.findFirst();
  return NextResponse.json({
    appName: branding?.appName ?? "LMS",
    logoPath: branding?.logoPath ?? null,
    bannerPath: branding?.bannerPath ?? null,
  });
}
