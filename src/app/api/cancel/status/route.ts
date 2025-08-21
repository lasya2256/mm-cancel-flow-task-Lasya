import { NextResponse } from "next/server";
import { getCancellationStatus } from "@/lib/db";

// GET /api/cancel/status
export async function GET() {
  try {
    const status = await getCancellationStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    console.error("status error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
