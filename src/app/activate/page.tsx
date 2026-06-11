import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentLicense } from "@/lib/license-verify";
import { ActivateClient } from "./activate-client";
import { NotActivatedPage } from "./not-activated";

export default async function ActivatePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles as unknown as string[] | undefined;
  const isAdminRole = roles?.includes("admin") || roles?.includes("superadmin") || false;

  if (!isAdminRole) {
    redirect("/not-activated");
  }

  const license = await getCurrentLicense();
  const isRenewal = !!license?.licenseId;
  const expired = license?.licenseExpiresAt
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
