import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    displayName: session.displayName,
    scannerName: session.scannerName,
    email: session.email,
  });
}
