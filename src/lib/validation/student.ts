import { z } from "zod";

/** Normalizes a raw phone number input: trims, strips spaces/dashes, removes +91/91 prefix. */
export function normalizePhoneNumber(raw: string): string {
  let value = raw.trim().replace(/[\s-]/g, "");
  if (value.startsWith("+91")) value = value.slice(3);
  else if (value.startsWith("91") && value.length === 12) value = value.slice(2);
  else if (value.startsWith("0") && value.length === 11) value = value.slice(1);
  return value;
}

// Indian mobile numbers: 10 digits, starting with 6, 7, 8, or 9.
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform(normalizePhoneNumber)
  .refine((val) => INDIAN_MOBILE_REGEX.test(val), {
    message: "Enter a valid 10-digit Indian mobile number",
  });

export const collegeTypeSchema = z.enum(["INNER", "OUTER"], {
  message: "College type must be INNER or OUTER",
});

export const createStudentSchema = z.object({
  phoneNumber: phoneNumberSchema,
  collegeType: collegeTypeSchema,
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export function collegeNameForType(collegeType: "INNER" | "OUTER"): string {
  return collegeType === "INNER" ? "PPG Institute of Technology" : "Outer College";
}

export const importRowSchema = z.object({
  phone_number: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  college_type: z.union([z.string(), z.number()]).transform((v) => String(v).trim().toUpperCase()),
});

export interface ImportRowResult {
  rowNumber: number;
  phoneNumberRaw: string;
  collegeTypeRaw: string;
  normalizedPhone?: string;
  collegeType?: "INNER" | "OUTER";
  status: "VALID" | "INVALID" | "DUPLICATE_IN_FILE" | "DUPLICATE_IN_DB";
  errors: string[];
}

export function validateImportRow(rowNumber: number, raw: unknown): ImportRowResult {
  const parsed = importRowSchema.safeParse(raw);
  const errors: string[] = [];

  if (!parsed.success) {
    return {
      rowNumber,
      phoneNumberRaw: "",
      collegeTypeRaw: "",
      status: "INVALID",
      errors: ["Row is missing phone_number or college_type"],
    };
  }

  const { phone_number, college_type } = parsed.data;
  let normalizedPhone: string | undefined;
  let collegeType: "INNER" | "OUTER" | undefined;

  const phoneResult = phoneNumberSchema.safeParse(phone_number);
  if (!phoneResult.success) {
    errors.push(phoneResult.error.issues[0]?.message ?? "Invalid phone number");
  } else {
    normalizedPhone = phoneResult.data;
  }

  const collegeResult = collegeTypeSchema.safeParse(college_type);
  if (!collegeResult.success) {
    errors.push("college_type must be INNER or OUTER");
  } else {
    collegeType = collegeResult.data;
  }

  return {
    rowNumber,
    phoneNumberRaw: String(phone_number),
    collegeTypeRaw: String(college_type),
    normalizedPhone,
    collegeType,
    status: errors.length > 0 ? "INVALID" : "VALID",
    errors,
  };
}
