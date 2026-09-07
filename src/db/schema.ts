import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SCANNER"]);
export const collegeTypeEnum = pgEnum("college_type", ["INNER", "OUTER"]);
export const qrStatusEnum = pgEnum("qr_status", ["UNUSED", "USED"]);
export const scanResultEnum = pgEnum("scan_result", [
  "SUCCESS",
  "ALREADY_USED",
  "INVALID_TOKEN",
]);

// Application users (equivalent to Supabase `profiles` linked to `auth.users`).
// Since this environment provisions a local PostgreSQL database rather than a
// Supabase project, authentication is implemented in-app (bcrypt + signed
// session cookie) instead of Supabase Auth. See README "Architecture Notes".
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("SCANNER"),
  displayName: text("display_name").notNull(),
  scannerName: text("scanner_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
}));

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneEncrypted: text("phone_number_encrypted").notNull(),
  phoneLookupHash: text("phone_number_lookup_hash").notNull(),
  phoneLast4: text("phone_last4").notNull(),
  collegeType: collegeTypeEnum("college_type").notNull(),
  collegeName: text("college_name").notNull(),
  qrTokenHash: text("qr_token_hash").notNull(),
  qrStatus: qrStatusEnum("qr_status").notNull().default("UNUSED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  qrTokenHashUnique: uniqueIndex("students_qr_token_hash_unique").on(table.qrTokenHash),
  phoneLookupHashIdx: index("students_phone_lookup_hash_idx").on(table.phoneLookupHash),
  createdAtIdx: index("students_created_at_idx").on(table.createdAt),
}));

export const scanLogs = pgTable("scan_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  scannerUserId: uuid("scanner_user_id").references(() => users.id, { onDelete: "set null" }),
  scannerName: text("scanner_name"),
  scanResult: scanResultEnum("scan_result").notNull(),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scannedAtIdx: index("scan_logs_scanned_at_idx").on(table.scannedAt),
  studentIdx: index("scan_logs_student_id_idx").on(table.studentId),
}));

export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type ScanLog = typeof scanLogs.$inferSelect;
