import { prisma } from "@/lib/prisma";

interface CreateNotifParams {
  userId: string;
  type: "course_assigned" | "deadline_warning" | "course_completed" | "license_expiry_warning";
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(params: CreateNotifParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId:  params.userId,
        type:    params.type,
        title:   params.title,
        message: params.message,
        link:    params.link ?? null,
      },
    });
  } catch {
    // Fire-and-forget — ne jamais bloquer l'opération principale
  }
}
