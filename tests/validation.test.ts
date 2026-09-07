import { describe, it, expect } from "vitest";
import {
  phoneNumberSchema,
  normalizePhoneNumber,
  collegeNameForType,
  validateImportRow,
} from "@/lib/validation/student";

describe("phone number validation", () => {
  it("accepts a valid 10-digit Indian mobile number", () => {
    const result = phoneNumberSchema.safeParse("9876543210");
    expect(result.success).toBe(true);
  });

  it("trims whitespace before validating", () => {
    const result = phoneNumberSchema.safeParse("  9876543210  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual("9876543210");
  });

  it("normalizes +91 and 0-prefixed numbers", () => {
    expect(normalizePhoneNumber("+919876543210")).toEqual("9876543210");
    expect(normalizePhoneNumber("09876543210")).toEqual("9876543210");
    expect(normalizePhoneNumber("919876543210")).toEqual("9876543210");
  });

  it("rejects numbers that are too short", () => {
    expect(phoneNumberSchema.safeParse("12345").success).toBe(false);
  });

  it("rejects numbers starting with an invalid digit", () => {
    expect(phoneNumberSchema.safeParse("1234567890").success).toBe(false);
    expect(phoneNumberSchema.safeParse("5876543210").success).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(phoneNumberSchema.safeParse("abcdefghij").success).toBe(false);
  });
});

describe("college name resolution", () => {
  it("maps INNER to PPG Institute of Technology", () => {
    expect(collegeNameForType("INNER")).toEqual("PPG Institute of Technology");
  });
  it("maps OUTER to Outer College", () => {
    expect(collegeNameForType("OUTER")).toEqual("Outer College");
  });
});

describe("bulk import row validation", () => {
  it("accepts a valid row", () => {
    const result = validateImportRow(2, { phone_number: "9876543210", college_type: "INNER" });
    expect(result.status).toEqual("VALID");
    expect(result.normalizedPhone).toEqual("9876543210");
    expect(result.collegeType).toEqual("INNER");
  });

  it("flags an invalid phone number", () => {
    const result = validateImportRow(2, { phone_number: "12345", college_type: "INNER" });
    expect(result.status).toEqual("INVALID");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("flags an invalid college type", () => {
    const result = validateImportRow(2, { phone_number: "9876543210", college_type: "FOREIGN" });
    expect(result.status).toEqual("INVALID");
  });

  it("is case-insensitive for college type", () => {
    const result = validateImportRow(2, { phone_number: "9876543210", college_type: "inner" });
    expect(result.status).toEqual("VALID");
    expect(result.collegeType).toEqual("INNER");
  });
});
