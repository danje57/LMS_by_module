import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentLicense } from "@/lib/license-verify";
import { ActivateClient } from "./activate-client";

export default async function ActivatePage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Seul l'admin peut activer/renouveler la licence
  if (session.user.sessionMode !== "admin") {
    redirect("/dashboard");
  }

  const license = await getCurrentLicense();
  const isRenewal = !!license?.licenseId;
  const expired   = license?.licenseExpiresAt
    ? new Date(license.licenseExpiresAt) < new Date()
    : false;

  return (
    <ActivateClient
      isRenewal={isRenewal}
      expired={expired}
      currentCompany={license?.company ?? null}
      currentEmail={license?.email ?? null}
      currentExpiry={license?.licenseExpiresAt?.toISOString() ?? null}
    />
  );
}
