import { NextResponse } from "next/server";
import { requireScanner, AuthorizationError } from "@/lib/auth/guards";
import { getTodaySuccessCountForScanner } from "@/lib/db/scans";

export async function GET() {
  let session;
  try {
    session = await requireScanner();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    throw error;
  }

  try {
    const todayCount = await getTodaySuccessCountForScanner(session.userId);
    return NextResponse.json({
      ok: true,
      scannerName: session.scannerName ?? session.displayName,
      todayCount,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load scanner status." }, { status: 500 });
  }
}
