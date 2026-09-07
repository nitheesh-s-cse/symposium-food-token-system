import { db, queryRows } from "@/db";
import { students } from "@/db/schema";
import { sql } from "drizzle-orm";
import { encryptPhoneNumber, decryptPhoneNumber, hashPhoneNumberForLookup, maskPhoneNumber } from "@/lib/security/crypto";
import { generateSecureQrToken, hashQrToken, buildQrPayload } from "@/lib/security/qrToken";
import { collegeNameForType, type CreateStudentInput } from "@/lib/validation/student";

export class DuplicateStudentError extends Error {
  constructor() {
    super("Student already registered.");
    this.name = "DuplicateStudentError";
  }
}

export async function findDuplicateLookupHashes(lookupHashes: string[]): Promise<Set<string>> {
  if (lookupHashes.length === 0) return new Set();
  const rows = await queryRows<{ phone_number_lookup_hash: string }>(
    sql`select phone_number_lookup_hash from students where phone_number_lookup_hash = any(${lookupHashes})`
  );
  return new Set(rows.map((r) => r.phone_number_lookup_hash));
}

export interface CreatedStudent {
  id: string;
  collegeType: "INNER" | "OUTER";
  collegeName: string;
  qrPayload: string;
  maskedPhone: string;
  qrStatus: string;
  createdAt: Date;
}

export async function createStudent(input: CreateStudentInput): Promise<CreatedStudent> {
  const lookupHash = hashPhoneNumberForLookup(input.phoneNumber);

  const existing = await queryRows<{ id: string }>(
    sql`select id from students where phone_number_lookup_hash = ${lookupHash} limit 1`
  );
  if (existing.length > 0) {
    throw new DuplicateStudentError();
  }

  const rawToken = generateSecureQrToken();
  const tokenHash = hashQrToken(rawToken);
  const collegeName = collegeNameForType(input.collegeType);
  const phoneEncrypted = encryptPhoneNumber(input.phoneNumber);
  const phoneLast4 = input.phoneNumber.slice(-4);

  const [row] = await db
    .insert(students)
    .values({
      phoneEncrypted,
      phoneLookupHash: lookupHash,
      phoneLast4,
      collegeType: input.collegeType,
      collegeName,
      qrTokenHash: tokenHash,
      qrStatus: "UNUSED",
    })
    .returning();

  return {
    id: row.id,
    collegeType: row.collegeType,
    collegeName: row.collegeName,
    qrPayload: buildQrPayload(rawToken),
    maskedPhone: maskPhoneNumber(input.phoneNumber),
    qrStatus: row.qrStatus,
    createdAt: row.createdAt,
  };
}

export interface BulkImportRow {
  normalizedPhone: string;
  collegeType: "INNER" | "OUTER";
}

export interface BulkImportOutcome {
  created: number;
  failed: Array<{ phoneNumber: string; reason: string }>;
}

export async function bulkCreateStudents(rows: BulkImportRow[]): Promise<BulkImportOutcome> {
  const outcome: BulkImportOutcome = { created: 0, failed: [] };

  for (const row of rows) {
    try {
      await createStudent({ phoneNumber: row.normalizedPhone, collegeType: row.collegeType });
      outcome.created += 1;
    } catch (error) {
      outcome.failed.push({
        phoneNumber: row.normalizedPhone,
        reason: error instanceof DuplicateStudentError ? "Student already registered." : "Failed to create student.",
      });
    }
  }

  return outcome;
}

export interface StudentListFilters {
  search?: string;
  collegeType?: "INNER" | "OUTER" | "ALL";
  qrStatus?: "UNUSED" | "USED" | "ALL";
  page: number;
  pageSize: number;
  sortBy?: "created_at" | "scanned_at" | "college_type" | "qr_status";
  sortDir?: "asc" | "desc";
}

export interface StudentListRow {
  id: string;
  phoneNumber: string;
  collegeType: string;
  collegeName: string;
  qrStatus: string;
  createdAt: Date;
  scannedAt: Date | null;
  scannerName: string | null;
}

export async function listStudents(filters: StudentListFilters): Promise<{ rows: StudentListRow[]; total: number }> {
  const conditions: ReturnType<typeof sql>[] = [];

  if (filters.collegeType && filters.collegeType !== "ALL") {
    conditions.push(sql`s.college_type = ${filters.collegeType}`);
  }
  if (filters.qrStatus && filters.qrStatus !== "ALL") {
    conditions.push(sql`s.qr_status = ${filters.qrStatus}`);
  }
  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim();
    if (/^\d{2,}$/.test(term)) {
      conditions.push(sql`s.phone_last4 like ${"%" + term.slice(-4)}`);
    }
  }

  const whereClause = conditions.length > 0
    ? sql`where ${sql.join(conditions, sql` and `)}`
    : sql``;

  const sortColumn = (() => {
    switch (filters.sortBy) {
      case "scanned_at": return sql`last_scan.scanned_at`;
      case "college_type": return sql`s.college_type`;
      case "qr_status": return sql`s.qr_status`;
      default: return sql`s.created_at`;
    }
  })();
  const sortDir = filters.sortDir === "asc" ? sql`asc` : sql`desc`;

  const offset = (filters.page - 1) * filters.pageSize;

  const dataQuery = sql`
    select
      s.id, s.phone_number_encrypted, s.college_type, s.college_name, s.qr_status, s.created_at,
      last_scan.scanned_at, last_scan.scanner_name
    from students s
    left join lateral (
      select scanned_at, scanner_name from scan_logs
      where student_id = s.id and scan_result = 'SUCCESS'
      order by scanned_at desc limit 1
    ) last_scan on true
    ${whereClause}
    order by ${sortColumn} ${sortDir} nulls last
    limit ${filters.pageSize} offset ${offset}
  `;

  const countQuery = sql`select count(*)::int as count from students s ${whereClause}`;

  const [dataRows, countRows] = await Promise.all([
    queryRows<{
      id: string; phone_number_encrypted: string; college_type: string; college_name: string;
      qr_status: string; created_at: Date; scanned_at: Date | null; scanner_name: string | null;
    }>(dataQuery),
    queryRows<{ count: number }>(countQuery),
  ]);

  const rows: StudentListRow[] = dataRows.map((r) => ({
    id: r.id,
    phoneNumber: safeDecrypt(r.phone_number_encrypted),
    collegeType: r.college_type,
    collegeName: r.college_name,
    qrStatus: r.qr_status,
    createdAt: r.created_at,
    scannedAt: r.scanned_at,
    scannerName: r.scanner_name,
  }));

  return { rows, total: countRows[0]?.count ?? 0 };
}

function safeDecrypt(payload: string): string {
  try {
    return decryptPhoneNumber(payload);
  } catch {
    return "DECRYPTION_ERROR";
  }
}

export async function getDashboardStats() {
  const rows = await queryRows<{
    total_students: number;
    inner_students: number;
    outer_students: number;
    total_tokens: number;
    used_tokens: number;
    unused_tokens: number;
    today_success_scans: number;
  }>(sql`
    select
      (select count(*)::int from students) as total_students,
      (select count(*)::int from students where college_type = 'INNER') as inner_students,
      (select count(*)::int from students where college_type = 'OUTER') as outer_students,
      (select count(*)::int from students) as total_tokens,
      (select count(*)::int from students where qr_status = 'USED') as used_tokens,
      (select count(*)::int from students where qr_status = 'UNUSED') as unused_tokens,
      (select count(*)::int from scan_logs where scan_result = 'SUCCESS' and scanned_at::date = current_date) as today_success_scans
  `);
  return rows[0];
}

export async function getScansByScanner() {
  return queryRows<{ scanner_name: string; count: number }>(sql`
    select coalesce(scanner_name, 'Unknown') as scanner_name, count(*)::int as count
    from scan_logs
    where scan_result = 'SUCCESS'
    group by scanner_name
    order by count desc
  `);
}

export async function getScansByHour() {
  return queryRows<{ hour_bucket: string; count: number }>(sql`
    select to_char(date_trunc('hour', scanned_at), 'HH24:00') as hour_bucket, count(*)::int as count
    from scan_logs
    where scan_result = 'SUCCESS' and scanned_at::date = current_date
    group by 1
    order by 1
  `);
}
