import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { LocaleSelector } from "@/components/profile/locale-selector";
import { User } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("profile");
  const locale = session.user.locale ?? "fr";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, createdAt: true, roles: { include: { role: true } } },
  });
  if (!user) redirect("/login");

  const joinedDate = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(user.createdAt);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">{t("title")}</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-[#8E8E93]" />
          </div>
          <div>
            <p className="text-[18px] font-semibold text-[#1D1D1F]">{user.name ?? "—"}</p>
            <p className="text-[14px] text-[#6E6E73]">{user.email}</p>
          </div>
        </div>

        <div className="h-px bg-[#F5F5F7]" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide mb-1">{t("roles")}</p>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map((ur) => (
                <span key={ur.role.id} className="text-[12px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                  {ur.role.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide mb-1">{t("memberSince")}</p>
            <p className="text-[14px] text-[#1D1D1F]">{joinedDate}</p>
          </div>
        </div>
      </div>

      <LocaleSelector currentLocale={locale} />
      <ChangePasswordForm />
    </div>
  );
}
