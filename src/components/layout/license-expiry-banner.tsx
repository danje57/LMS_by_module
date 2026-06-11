"use client";

import Link from "next/link";

interface Props {
  daysLeft: number;
}

export function LicenseExpiryBanner({ daysLeft }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-6 py-2.5 text-[13px] text-amber-800 dark:text-amber-300">
      <span>
        ⚠️ Votre licence expire dans <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong>. Renouvelez-la pour maintenir l&apos;accès à l&apos;application.
      </span>
      <Link
        href="/dashboard/admin/license"
        className="shrink-0 font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
      >
        Renouveler →
      </Link>
    </div>
  );
}
