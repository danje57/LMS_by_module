import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LicenseClient } from "./license-client";

export default async function LicensePage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");
  return <LicenseClient />;
}
