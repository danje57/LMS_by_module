import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotActivatedPage } from "@/app/activate/not-activated";

export default async function NotActivatedRoute() {
  const session = await auth();
  if (!session) redirect("/login");
  return <NotActivatedPage />;
}
