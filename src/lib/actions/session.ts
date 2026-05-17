"use server";

import { updateSession } from "@/lib/auth";

export async function setSessionMode(mode: "admin" | "user") {
  await updateSession({ sessionMode: mode } as Parameters<typeof updateSession>[0]);
}
