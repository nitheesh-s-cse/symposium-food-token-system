import { NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { buildStudentsWorkbook } from "@/lib/export/excel";

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
    const buffer = await buildStudentsWorkbook();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="students-export-${Date.now()}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate export." }, { status: 500 });
  }
}
