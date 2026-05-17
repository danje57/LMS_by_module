import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/courses/upload-form";

export default async function UploadPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard/courses");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ajouter un cours</h1>
        <p className="text-muted-foreground mt-1">
          Upload d&apos;un fichier H5P avec ses métadonnées
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
