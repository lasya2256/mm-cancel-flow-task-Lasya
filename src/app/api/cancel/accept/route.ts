import { NextResponse } from "next/server";
import { acceptDownsell } from "@/lib/db";

export async function POST() {
  try {
    const { newPrice } = await acceptDownsell();
    return NextResponse.json({ ok: true, newPrice });
  } catch (err) {
    console.error("accept downsell error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
