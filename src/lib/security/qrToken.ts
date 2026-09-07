import crypto from "crypto";

export const QR_TOKEN_PREFIX = "FOOD-TOKEN:";

/**
 * Generates a cryptographically secure random QR token. This is the raw
 * value encoded into the QR image. It is intentionally NOT derived from
 * the phone number, a timestamp, or a sequential ID, and is long enough
 * (256 bits of entropy) to make brute-force enumeration infeasible.
 */
export function generateSecureQrToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** One-way hash of the raw token. Only this hash is stored in the database. */
export function hashQrToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Builds the full QR payload string embedded in the QR image. */
export function buildQrPayload(rawToken: string): string {
  return `${QR_TOKEN_PREFIX}${rawToken}`;
}

/** Extracts the raw token from a scanned QR payload (handles plain token or URL forms). */
export function extractTokenFromPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(QR_TOKEN_PREFIX)) {
    return trimmed.slice(QR_TOKEN_PREFIX.length);
  }

  // Support payloads that embed the token in a URL, e.g. https://host/scan?token=XYZ
  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) return tokenParam;
  } catch {
    // Not a URL — fall through
  }

  // Fallback: treat the raw scanned text as the token itself.
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
