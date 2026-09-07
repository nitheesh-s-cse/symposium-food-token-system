import { NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { buildScanLogsWorkbook } from "@/lib/export/excel";

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
    const buffer = await buildScanLogsWorkbook();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="scan-history-export-${Date.now()}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate export." }, { status: 500 });
  }
}
