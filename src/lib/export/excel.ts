import * as XLSX from "xlsx";
import { queryRows } from "@/db";
import { sql } from "drizzle-orm";
import { decryptPhoneNumber } from "@/lib/security/crypto";

interface StudentExportRow {
  id: string;
  phone_number_encrypted: string;
  college_type: string;
  college_name: string;
  qr_status: string;
  created_at: Date;
  scanned_at: Date | null;
  scanner_name: string | null;
  [key: string]: unknown;
}

export async function buildStudentsWorkbook(): Promise<Buffer> {
  const rows = await queryRows<StudentExportRow>(sql`
    select s.id, s.phone_number_encrypted, s.college_type, s.college_name, s.qr_status, s.created_at,
      last_scan.scanned_at, last_scan.scanner_name
    from students s
    left join lateral (
      select scanned_at, scanner_name from scan_logs
      where student_id = s.id and scan_result = 'SUCCESS'
      order by scanned_at desc limit 1
    ) last_scan on true
    order by s.created_at desc
  `);

  const sheetRows = rows.map((r) => ({
    "Student ID": r.id,
    "Phone Number": safeDecrypt(r.phone_number_encrypted),
    "College Type": r.college_type,
    "College Name": r.college_name,
    "QR Status": r.qr_status,
    "Created At": formatDate(r.created_at),
    "Scanned At": r.scanned_at ? formatDate(r.scanned_at) : "",
    "Scanner Name": r.scanner_name ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

interface ScanLogExportRow {
  student_id: string | null;
  phone_number_encrypted: string | null;
  college_type: string | null;
  scan_result: string;
  scanner_name: string | null;
  scanned_at: Date;
  [key: string]: unknown;
}

export async function buildScanLogsWorkbook(): Promise<Buffer> {
  const rows = await queryRows<ScanLogExportRow>(sql`
    select sl.student_id, s.phone_number_encrypted, s.college_type, sl.scan_result, sl.scanner_name, sl.scanned_at
    from scan_logs sl
    left join students s on s.id = sl.student_id
    order by sl.scanned_at desc
  `);

  const sheetRows = rows.map((r) => ({
    "Student ID": r.student_id ?? "",
    "Phone Number": r.phone_number_encrypted ? safeDecrypt(r.phone_number_encrypted) : "",
    "College Type": r.college_type ?? "",
    "Scan Result": r.scan_result,
    "Scanner Name": r.scanner_name ?? "",
    "Scanned At": formatDate(r.scanned_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Scan History");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function safeDecrypt(payload: string): string {
  try {
    return decryptPhoneNumber(payload);
  } catch {
    return "DECRYPTION_ERROR";
  }
}

function formatDate(date: Date): string {
  return new Date(date).toISOString().replace("T", " ").slice(0, 19);
}
