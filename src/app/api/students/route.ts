import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { createStudentSchema } from "@/lib/validation/student";
import { createStudent, DuplicateStudentError, listStudents } from "@/lib/db/students";

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

  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  try {
    const student = await createStudent(parsed.data);
    return NextResponse.json({ ok: true, student });
  } catch (error) {
    if (error instanceof DuplicateStudentError) {
      return NextResponse.json({ error: "Student already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create student." }, { status: 500 });
  }
}

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
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  try {
    const result = await listStudents({
      search: searchParams.get("search") ?? undefined,
      collegeType: (searchParams.get("collegeType") as "INNER" | "OUTER" | "ALL" | null) ?? "ALL",
      qrStatus: (searchParams.get("qrStatus") as "UNUSED" | "USED" | "ALL" | null) ?? "ALL",
      page,
      pageSize,
      sortBy: (searchParams.get("sortBy") as "created_at" | "scanned_at" | "college_type" | "qr_status" | null) ?? "created_at",
      sortDir: (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc",
    });
    return NextResponse.json({ ok: true, ...result, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Failed to load students." }, { status: 500 });
  }
}
