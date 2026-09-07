import { NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { getDashboardStats, getScansByScanner, getScansByHour } from "@/lib/db/students";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    throw error;
  }

  try {
    const [stats, byScanner, byHour] = await Promise.all([
      getDashboardStats(),
      getScansByScanner(),
      getScansByHour(),
    ]);
    return NextResponse.json({ ok: true, stats, byScanner, byHour });
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard stats." }, { status: 500 });
  }
}
