import { auth } from "@/lib/auth";
import { EditCourseForm } from "./edit-form";

export default async function EditCoursePage() {
  const session = await auth();
  const isAdmin = session?.user?.sessionMode === "admin";
  return <EditCourseForm isAdmin={isAdmin} />;
}
