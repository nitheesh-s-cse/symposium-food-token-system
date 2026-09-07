import { db } from "@/db";
import { users } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: "ADMIN" | "SCANNER";
  displayName: string;
  scannerName?: string | null;
}) {
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      displayName: input.displayName,
      scannerName: input.scannerName ?? null,
    })
    .returning();
  return row;
}

export async function listUsers() {
  return db.select().from(users).orderBy(users.createdAt);
}
