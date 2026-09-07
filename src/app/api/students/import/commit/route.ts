import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { bulkCreateStudents } from "@/lib/db/students";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rows = (body as { rows?: Array<{ normalizedPhone: string; collegeType: "INNER" | "OUTER" }> })?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import." }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "A maximum of 5000 rows can be imported at a time." }, { status: 400 });
  }

  try {
    const outcome = await bulkCreateStudents(rows);
    return NextResponse.json({ ok: true, ...outcome });
  } catch {
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
