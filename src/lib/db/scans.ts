import { queryRows } from "@/db";
import { sql } from "drizzle-orm";

export type ScanRpcResult = "SUCCESS" | "ALREADY_USED" | "INVALID_TOKEN";

export interface ConsumeTokenResult {
  result: ScanRpcResult;
  studentId: string | null;
  collegeType: string | null;
  collegeName: string | null;
  phoneLast4: string | null;
  scannedAt: Date | null;
  prevScannedAt: Date | null;
  prevScannerName: string | null;
}

/**
 * Calls the atomic `consume_food_token` PostgreSQL function. All the
 * concurrency-safety guarantees live inside that single SQL function
 * (row lock via `FOR UPDATE`) — this is intentionally a thin wrapper.
 */
export async function consumeFoodToken(
  tokenHash: string,
  scannerUserId: string,
  scannerName: string
): Promise<ConsumeTokenResult> {
  const rows = await queryRows<{
    result: ScanRpcResult;
    out_student_id: string | null;
    out_college_type: string | null;
    out_college_name: string | null;
    out_phone_last4: string | null;
    out_scanned_at: Date | null;
    out_prev_scanned_at: Date | null;
    out_prev_scanner_name: string | null;
  }>(sql`select * from consume_food_token(${tokenHash}, ${scannerUserId}, ${scannerName})`);

  const row = rows[0];
  return {
    result: row.result,
    studentId: row.out_student_id,
    collegeType: row.out_college_type,
    collegeName: row.out_college_name,
    phoneLast4: row.out_phone_last4,
    scannedAt: row.out_scanned_at,
    prevScannedAt: row.out_prev_scanned_at,
    prevScannerName: row.out_prev_scanner_name,
  };
}

export async function getTodaySuccessCountForScanner(scannerUserId: string): Promise<number> {
  const rows = await queryRows<{ count: number }>(sql`
    select count(*)::int as count from scan_logs
    where scanner_user_id = ${scannerUserId}
      and scan_result = 'SUCCESS'
      and scanned_at::date = current_date
  `);
  return rows[0]?.count ?? 0;
}

export interface ScanLogFilters {
  date?: string;
  scannerName?: string;
  collegeType?: "INNER" | "OUTER" | "ALL";
  result?: ScanRpcResult | "ALL";
  page: number;
  pageSize: number;
}

export interface ScanLogRow {
  id: string;
  studentId: string | null;
  phoneLast4: string | null;
  collegeType: string | null;
  collegeName: string | null;
  scanResult: ScanRpcResult;
  scannerName: string | null;
  scannedAt: Date;
}

export async function listScanLogs(filters: ScanLogFilters): Promise<{ rows: ScanLogRow[]; total: number }> {
  const conditions: ReturnType<typeof sql>[] = [];

  if (filters.date) {
    conditions.push(sql`sl.scanned_at::date = ${filters.date}::date`);
  }
  if (filters.scannerName) {
    conditions.push(sql`sl.scanner_name = ${filters.scannerName}`);
  }
  if (filters.collegeType && filters.collegeType !== "ALL") {
    conditions.push(sql`s.college_type = ${filters.collegeType}`);
  }
  if (filters.result && filters.result !== "ALL") {
    conditions.push(sql`sl.scan_result = ${filters.result}`);
  }

  const whereClause = conditions.length > 0 ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;
  const offset = (filters.page - 1) * filters.pageSize;

  const dataQuery = sql`
    select sl.id, sl.student_id, s.phone_last4, s.college_type, s.college_name,
      sl.scan_result, sl.scanner_name, sl.scanned_at
    from scan_logs sl
    left join students s on s.id = sl.student_id
    ${whereClause}
    order by sl.scanned_at desc
    limit ${filters.pageSize} offset ${offset}
  `;
  const countQuery = sql`
    select count(*)::int as count from scan_logs sl left join students s on s.id = sl.student_id ${whereClause}
  `;

  const [dataRows, countRows] = await Promise.all([
    queryRows<{
      id: string; student_id: string | null; phone_last4: string | null; college_type: string | null;
      college_name: string | null; scan_result: ScanRpcResult; scanner_name: string | null; scanned_at: Date;
    }>(dataQuery),
    queryRows<{ count: number }>(countQuery),
  ]);

  const rows: ScanLogRow[] = dataRows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    phoneLast4: r.phone_last4,
    collegeType: r.college_type,
    collegeName: r.college_name,
    scanResult: r.scan_result,
    scannerName: r.scanner_name,
    scannedAt: r.scanned_at,
  }));

  return { rows, total: countRows[0]?.count ?? 0 };
}
