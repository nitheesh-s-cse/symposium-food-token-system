import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScanner, AuthorizationError } from "@/lib/auth/guards";
import { extractTokenFromPayload } from "@/lib/security/qrToken";
import { hashQrToken } from "@/lib/security/qrToken";
import { consumeFoodToken } from "@/lib/db/scans";

const consumeSchema = z.object({
  payload: z.string().trim().min(1, "QR payload is required"),
});

// Very small in-memory rate limiter: caps rapid-fire scan attempts per
// scanner user. This is a pragmatic abuse guard for a single-process
// deployment; a distributed deployment should use a shared store (e.g.
// Redis) instead.
const attemptWindow = new Map<string, number[]>();
const MAX_ATTEMPTS_PER_WINDOW = 20;
const WINDOW_MS = 10_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempts = (attemptWindow.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.push(now);
  attemptWindow.set(key, attempts);
  return attempts.length > MAX_ATTEMPTS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireScanner();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    throw error;
  }

  if (isRateLimited(session.userId)) {
    return NextResponse.json(
      { error: "Too many scan attempts. Please slow down." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = consumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A QR payload is required." }, { status: 400 });
  }

  const token = extractTokenFromPayload(parsed.data.payload);
  if (!token) {
    return NextResponse.json({
      ok: true,
      result: "INVALID_TOKEN",
      message: "This food token is not valid.",
    });
  }

  const tokenHash = hashQrToken(token);
  const scannerName = session.scannerName ?? session.displayName;

  try {
    const outcome = await consumeFoodToken(tokenHash, session.userId, scannerName);
    return NextResponse.json({ ok: true, ...outcome });
  } catch {
    return NextResponse.json({ error: "Scan failed. Please try again." }, { status: 500 });
  }
}
