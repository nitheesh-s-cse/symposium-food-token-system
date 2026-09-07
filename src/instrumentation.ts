export async function register() {
  // Only run in the Node.js server runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { pool } = await import("@/db");
    const { BOOTSTRAP_SQL } = await import("@/db/bootstrap-sql");
    try {
      await pool.query(BOOTSTRAP_SQL);
      // eslint-disable-next-line no-console
      console.log("[bootstrap] database functions/triggers ensured");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[bootstrap] failed to apply database bootstrap SQL", error);
    }
  }
}
