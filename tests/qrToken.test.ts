import { describe, it, expect } from "vitest";
import {
  generateSecureQrToken,
  hashQrToken,
  buildQrPayload,
  extractTokenFromPayload,
  QR_TOKEN_PREFIX,
} from "@/lib/security/qrToken";

describe("QR token generation", () => {
  it("generates sufficiently long, unique, random tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const token = generateSecureQrToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
  });

  it("never contains a phone number or sequential pattern", () => {
    const token = generateSecureQrToken();
    expect(token).not.toMatch(/^\d{10}$/);
  });

  it("hashes tokens deterministically", () => {
    const token = generateSecureQrToken();
    const hash1 = hashQrToken(token);
    const hash2 = hashQrToken(token);
    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64); // sha256 hex
  });

  it("produces different hashes for different tokens", () => {
    const a = hashQrToken(generateSecureQrToken());
    const b = hashQrToken(generateSecureQrToken());
    expect(a).not.toEqual(b);
  });

  it("builds a payload with the expected prefix and extracts it back", () => {
    const token = generateSecureQrToken();
    const payload = buildQrPayload(token);
    expect(payload.startsWith(QR_TOKEN_PREFIX)).toBe(true);
    expect(extractTokenFromPayload(payload)).toEqual(token);
  });

  it("extracts a token embedded in a URL payload", () => {
    const token = generateSecureQrToken();
    const url = `https://symposium.example.com/scan?token=${token}`;
    expect(extractTokenFromPayload(url)).toEqual(token);
  });

  it("returns null for garbage payloads", () => {
    expect(extractTokenFromPayload("")).toBeNull();
    expect(extractTokenFromPayload("hi")).toBeNull();
  });
});
