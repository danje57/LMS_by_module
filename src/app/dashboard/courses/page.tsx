import { prisma } from "@/lib/prisma";
import { CourseList } from "@/components/courses/course-list";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";

async function getCourses() {
  return prisma.course.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export default async function CoursesPage() {
  const session = await auth();
  const courses = await getCourses();
  const isAdmin = session?.user.roles.includes("admin");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Cours</h1>
          <p className="text-[15px] text-[#6E6E73] mt-0.5">
            {courses.length} cours disponible{courses.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/courses/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Link>
        )}
      </div>
      <CourseList courses={courses} isAdmin={isAdmin} />
    </div>
  );
}
