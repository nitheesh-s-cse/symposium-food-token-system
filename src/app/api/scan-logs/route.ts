import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { listScanLogs, type ScanRpcResult } from "@/lib/db/scans";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25));

  try {
    const result = await listScanLogs({
      date: searchParams.get("date") ?? undefined,
      scannerName: searchParams.get("scannerName") ?? undefined,
      collegeType: (searchParams.get("collegeType") as "INNER" | "OUTER" | "ALL" | null) ?? "ALL",
      result: (searchParams.get("result") as ScanRpcResult | "ALL" | null) ?? "ALL",
      page,
      pageSize,
    });
    return NextResponse.json({ ok: true, ...result, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Failed to load scan history." }, { status: 500 });
  }
}
