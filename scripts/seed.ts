/**
 * DEVELOPMENT ONLY seed script.
 *
 * Creates:
 *  - one ADMIN account
 *  - four SCANNER accounts (Scanner 1..4)
 *  - a handful of clearly-fake student records for local testing
 *
 * NEVER run this against a production database. Real phone numbers must
 * NEVER be placed in this file — only the obviously fake 90000000xx range
 * is used here.
 *
 * Usage: npx tsx scripts/seed.ts
 */
import "dotenv/config";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { createStudent, DuplicateStudentError } from "../src/lib/db/students";
import { BOOTSTRAP_SQL } from "../src/db/bootstrap-sql";
import { sql } from "drizzle-orm";

const DEV_ACCOUNTS = [
  { email: "admin@symposium.local", password: "Admin@12345", role: "ADMIN" as const, displayName: "Symposium Admin", scannerName: null },
  { email: "scanner1@symposium.local", password: "Scanner@123", role: "SCANNER" as const, displayName: "Scanner 1", scannerName: "Scanner 1" },
  { email: "scanner2@symposium.local", password: "Scanner@123", role: "SCANNER" as const, displayName: "Scanner 2", scannerName: "Scanner 2" },
  { email: "scanner3@symposium.local", password: "Scanner@123", role: "SCANNER" as const, displayName: "Scanner 3", scannerName: "Scanner 3" },
  { email: "scanner4@symposium.local", password: "Scanner@123", role: "SCANNER" as const, displayName: "Scanner 4", scannerName: "Scanner 4" },
];

// DEVELOPMENT ONLY fake phone numbers. Never use real student numbers here.
const DEV_STUDENTS: Array<{ phoneNumber: string; collegeType: "INNER" | "OUTER" }> = [
  { phoneNumber: "9000000001", collegeType: "INNER" },
  { phoneNumber: "9000000002", collegeType: "INNER" },
  { phoneNumber: "9000000003", collegeType: "OUTER" },
  { phoneNumber: "9000000004", collegeType: "OUTER" },
];

async function main() {
  console.log("Applying bootstrap SQL (extensions/functions/triggers)...");
  await pool.query(BOOTSTRAP_SQL);

  console.log("Seeding development accounts...");
  for (const account of DEV_ACCOUNTS) {
    const existing = await db.execute(sql`select id from users where lower(email) = lower(${account.email}) limit 1`);
    if (existing.rows.length > 0) {
      console.log(`  - ${account.email} already exists, skipping`);
      continue;
    }
    const passwordHash = await hashPassword(account.password);
    await db.insert(users).values({
      email: account.email,
      passwordHash,
      role: account.role,
      displayName: account.displayName,
      scannerName: account.scannerName,
    });
    console.log(`  - created ${account.role} account: ${account.email} / ${account.password}`);
  }

  console.log("Seeding development-only fake students...");
  for (const student of DEV_STUDENTS) {
    try {
      await createStudent(student);
      console.log(`  - created fake student ${student.phoneNumber} (${student.collegeType})`);
    } catch (error) {
      if (error instanceof DuplicateStudentError) {
        console.log(`  - fake student ${student.phoneNumber} already exists, skipping`);
      } else {
        throw error;
      }
    }
  }

  console.log("\nSeed complete. DEVELOPMENT ONLY credentials:");
  for (const account of DEV_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(8)} ${account.email} / ${account.password}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
