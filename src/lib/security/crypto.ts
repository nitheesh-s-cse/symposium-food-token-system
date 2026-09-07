import crypto from "crypto";

/**
 * Server-only phone number encryption (AES-256-GCM) and deterministic
 * lookup hashing (HMAC-SHA256). Never import this file from client
 * components — it reads secrets from process.env that must never reach
 * the browser bundle.
 */

function getEncryptionKey(): Buffer {
  const raw = process.env.PHONE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("PHONE_ENCRYPTION_KEY is not configured on the server");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PHONE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)");
  }
  return key;
}

function getHashKey(): Buffer {
  const raw = process.env.PHONE_HASH_KEY;
  if (!raw) {
    throw new Error("PHONE_HASH_KEY is not configured on the server");
  }
  return Buffer.from(raw, "base64");
}

/** Encrypts a phone number for storage at rest. Format: iv:authTag:ciphertext (base64). */
export function encryptPhoneNumber(phoneNumber: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(phoneNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Decrypts a phone number. Only ever call this from authenticated admin-only server code. */
export function decryptPhoneNumber(payload: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted phone payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Deterministic HMAC used ONLY for exact-match duplicate detection and
 * search. It never reveals the phone number and cannot be reversed.
 */
export function hashPhoneNumberForLookup(normalizedPhoneNumber: string): string {
  const key = getHashKey();
  return crypto.createHmac("sha256", key).update(normalizedPhoneNumber).digest("hex");
}

export function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `${"*".repeat(Math.max(0, digits.length - 4))}${last4}`;
}
