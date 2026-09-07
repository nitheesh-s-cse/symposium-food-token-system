import { describe, it, expect } from "vitest";
import {
  encryptPhoneNumber,
  decryptPhoneNumber,
  hashPhoneNumberForLookup,
  maskPhoneNumber,
} from "@/lib/security/crypto";

describe("phone number encryption", () => {
  it("round-trips a phone number through encryption and decryption", () => {
    const phone = "9876543210";
    const encrypted = encryptPhoneNumber(phone);
    expect(encrypted).not.toContain(phone);
    expect(decryptPhoneNumber(encrypted)).toEqual(phone);
  });

  it("produces different ciphertext for the same input each time (random IV)", () => {
    const phone = "9876543210";
    const a = encryptPhoneNumber(phone);
    const b = encryptPhoneNumber(phone);
    expect(a).not.toEqual(b);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const encrypted = encryptPhoneNumber("9876543210");
    const tampered = encrypted.slice(0, -4) + "abcd";
    expect(() => decryptPhoneNumber(tampered)).toThrow();
  });
});

describe("phone number lookup hashing", () => {
  it("is deterministic for duplicate detection", () => {
    const a = hashPhoneNumberForLookup("9876543210");
    const b = hashPhoneNumberForLookup("9876543210");
    expect(a).toEqual(b);
  });

  it("differs for different phone numbers", () => {
    const a = hashPhoneNumberForLookup("9876543210");
    const b = hashPhoneNumberForLookup("9876543211");
    expect(a).not.toEqual(b);
  });
});

describe("phone number masking", () => {
  it("masks all but the last 4 digits", () => {
    expect(maskPhoneNumber("9876543210")).toEqual("******3210");
  });
});
