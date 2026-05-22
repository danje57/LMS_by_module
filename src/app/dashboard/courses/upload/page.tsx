import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "@/components/courses/upload-form";
import { getTranslations } from "next-intl/server";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAdmin = session.user.sessionMode === "admin";
  if (!isAdmin) {
    const role = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
    });
    if (!role) redirect("/dashboard/courses");
  }

  const creators = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { name: { in: ["manager", "creator"] } } } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  const t = await getTranslations("upload");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{t("addCourse")}</h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{t("uploadExistingH5p")}</p>
      </div>
      <UploadForm isAdmin={isAdmin} userId={session.user.id} creators={creators} />
    </div>
  );
}
