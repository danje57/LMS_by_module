import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "@/components/courses/upload-form";

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Ajouter un cours</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">Upload d&apos;un fichier H5P avec ses métadonnées</p>
      </div>
      <UploadForm isAdmin={isAdmin} userId={session.user.id} creators={creators} />
    </div>
  );
}
