import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const passwordOk =
      (await verifyPassword(parsed.data.password, user.passwordHash)) ||
      (await verifyPassword(parsed.data.password.trim(), user.passwordHash));
    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      role: user.role,
      displayName: user.displayName,
      scannerName: user.scannerName,
      email: user.email,
    });

    const response = NextResponse.json({
      ok: true,
      role: user.role,
      redirectTo: user.role === "ADMIN" ? "/admin" : "/scanner",
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[login error]", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Login failed. Please try again.", details }, { status: 500 });
  }
}
