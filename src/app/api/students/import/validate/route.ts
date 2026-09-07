import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthorizationError } from "@/lib/auth/guards";
import { validateImportRow, type ImportRowResult } from "@/lib/validation/student";
import { hashPhoneNumberForLookup } from "@/lib/security/crypto";
import { findDuplicateLookupHashes } from "@/lib/db/students";

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

  const rows = (body as { rows?: unknown[] })?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows found in the uploaded file." }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "A maximum of 5000 rows can be imported at a time." }, { status: 400 });
  }

  const results: ImportRowResult[] = rows.map((row, index) => validateImportRow(index + 2, row));

  const seenInFile = new Map<string, number>();
  for (const row of results) {
    if (row.status !== "VALID" || !row.normalizedPhone) continue;
    if (seenInFile.has(row.normalizedPhone)) {
      row.status = "DUPLICATE_IN_FILE";
      row.errors.push(`Duplicate of row ${seenInFile.get(row.normalizedPhone)}`);
    } else {
      seenInFile.set(row.normalizedPhone, row.rowNumber);
    }
  }

  const validPhones = results
    .filter((r) => r.status === "VALID" && r.normalizedPhone)
    .map((r) => r.normalizedPhone as string);
  const lookupHashes = validPhones.map(hashPhoneNumberForLookup);
  const existingHashes = await findDuplicateLookupHashes(lookupHashes);

  for (const row of results) {
    if (row.status === "VALID" && row.normalizedPhone) {
      const hash = hashPhoneNumberForLookup(row.normalizedPhone);
      if (existingHashes.has(hash)) {
        row.status = "DUPLICATE_IN_DB";
        row.errors.push("Phone number already registered.");
      }
    }
  }

  const summary = {
    totalRows: results.length,
    validRows: results.filter((r) => r.status === "VALID").length,
    invalidRows: results.filter((r) => r.status === "INVALID").length,
    duplicateRows: results.filter((r) => r.status === "DUPLICATE_IN_FILE" || r.status === "DUPLICATE_IN_DB").length,
  };

  return NextResponse.json({ ok: true, results, summary });
}
