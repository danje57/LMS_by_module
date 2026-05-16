import { prisma } from "@/lib/prisma";
import { CourseList } from "@/components/courses/course-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cours</h1>
          <p className="text-muted-foreground mt-1">{courses.length} cours disponible{courses.length > 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/dashboard/courses/upload">
              <Plus className="h-4 w-4" />
              Ajouter un cours
            </Link>
          </Button>
        )}
      </div>
      <CourseList courses={courses} />
    </div>
  );
}
