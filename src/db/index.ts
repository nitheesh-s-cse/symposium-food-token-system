import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const cleanDatabaseUrl = databaseUrl.replace(/^["']|["']$/g, "").trim();

const isLocal =
  cleanDatabaseUrl.includes("localhost") ||
  cleanDatabaseUrl.includes("127.0.0.1");

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: cleanDatabaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

import type { SQL } from "drizzle-orm";

/**
 * Thin helper around db.execute() that returns typed rows without tripping
 * the `Record<string, unknown>` generic constraint on every call site.
 */
export async function queryRows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as unknown as T[];
}

