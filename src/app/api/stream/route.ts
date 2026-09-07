import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { pool } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint that relays PostgreSQL NOTIFY messages
 * (emitted by triggers on `scan_logs` / `students`, see
 * `src/db/bootstrap-sql.ts`) to any connected admin dashboard or scanner
 * device. This is how all scanner devices "immediately" learn that a
 * token has been consumed elsewhere, without polling the database.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const client = await pool.connect();
  await client.query("LISTEN scan_events");

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed; ignore.
        }
      };

      send("connected", { ok: true });

      const onNotification = (msg: { payload?: string }) => {
        if (!msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload);
          send("scan-event", parsed);
        } catch {
          // Ignore malformed payloads.
        }
      };

      client.on("notification", onNotification);

      const keepAlive = setInterval(() => send("ping", { t: Date.now() }), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        client.removeListener("notification", onNotification);
        client.query("UNLISTEN scan_events").catch(() => {});
        client.release(true);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
