import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  redirect(session.role === "ADMIN" ? "/admin" : "/scanner");
}
