import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
}

async function readRole(token: string | undefined): Promise<"ADMIN" | "SCANNER" | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const role = payload.role;
    if (role === "ADMIN" || role === "SCANNER") return role;
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isScannerRoute = pathname.startsWith("/scanner");

  if (!isAdminRoute && !isScannerRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const role = await readRole(token);

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/scanner", request.url));
  }

  if (isScannerRoute && role !== "SCANNER") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scanner/:path*"],
};
