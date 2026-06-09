import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ActivityClient from "./activity-client";

export default async function ActivityPage() {
  const session = await auth();
  if (session?.user.sessionMode !== "admin") redirect("/dashboard");

  return <ActivityClient />;
}
