import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ScannerLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/scanner");
  }
  if (session.role !== "SCANNER") {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">
            PPG Institute of Technology
          </p>
          <h1 className="text-sm font-bold text-white">Symposium Scanner</h1>
        </div>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
    </div>
  );
}
