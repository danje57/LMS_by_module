import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GraduationCap } from "lucide-react";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" }, include: { users: { take: 1 } } });
  if (adminRole && adminRole.users.length > 0) redirect("/login");

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#0071E3] flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            Installation
          </h1>
          <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-1 text-center">
            Créez le premier compte administrateur
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm border border-[#D2D2D7]/60 dark:border-[#3A3A3C] px-8 py-8">
          <SetupForm />
        </div>

        <p className="text-center text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-6">
          Cette page disparaît une fois l&apos;installation terminée.
        </p>
      </div>
    </div>
  );
}
