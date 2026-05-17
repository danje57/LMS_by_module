import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { revalidatePath } from "next/cache";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_LOGO = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

async function saveFile(file: File, subfolder: string, maxSize: number): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Type de fichier non autorisé : ${file.type}`);
  }
  if (file.size > maxSize) {
    throw new Error(`Fichier trop volumineux (max ${maxSize / (1024 * 1024)} Mo)`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `${Date.now()}.${ext}`;
  const dir = path.join(UPLOAD_DIR, subfolder);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buffer);

  return path.join(subfolder, filename);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const form = await req.formData();
  const appName = (form.get("appName") as string | null)?.trim();

  if (!appName) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  }

  const existing = await prisma.brandingSetting.findFirst();

  const loginNotice = (form.get("loginNotice") as string | null) ?? null;
  const updateData: { appName: string; logoPath?: string; bannerPath?: string; loginNotice?: string | null } = {
    appName,
    loginNotice: loginNotice?.trim() || null,
  };

  try {
    const logoFile = form.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      updateData.logoPath = await saveFile(logoFile, "branding/logo", MAX_LOGO);
    }

    if (existing) {
      await prisma.brandingSetting.update({ where: { id: existing.id }, data: updateData });
    } else {
      await prisma.brandingSetting.create({ data: updateData });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inattendue";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Invalider le cache des pages qui affichent le branding
  revalidatePath("/login");
  revalidatePath("/dashboard", "layout");

  return NextResponse.json({ ok: true });
}
