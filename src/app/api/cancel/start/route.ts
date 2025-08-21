import { NextResponse } from "next/server";
import { z } from "zod";
import { startCancellation } from "@/lib/db";

const Body = z.object({
  variant: z.enum(["A", "B"]),
  reason: z.string().trim().max(500).nullable().optional(),
});

// POST /api/cancel/start
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { variant, reason = null } = parsed.data;
    await startCancellation(variant, reason);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("start cancel error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
