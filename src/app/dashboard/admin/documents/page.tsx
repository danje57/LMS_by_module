import { redirect } from "next/navigation";

export default function AdminDocumentsRedirect() {
  redirect("/dashboard/documents?tab=library");
}
