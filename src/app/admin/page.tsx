import { getDashboardStats, getScansByScanner, getScansByHour } from "@/lib/db/students";
import { DashboardClient } from "@/components/admin/DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, byScanner, byHour] = await Promise.all([
    getDashboardStats(),
    getScansByScanner(),
    getScansByHour(),
  ]);

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-slate-900">Dashboard</h2>
      <DashboardClient
        initialData={{
          stats: stats ?? {
            total_students: 0,
            inner_students: 0,
            outer_students: 0,
            total_tokens: 0,
            used_tokens: 0,
            unused_tokens: 0,
            today_success_scans: 0,
          },
          byScanner,
          byHour,
        }}
      />
    </div>
  );
}
