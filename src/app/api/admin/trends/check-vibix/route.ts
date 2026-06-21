import { NextResponse } from "next/server";
import { checkTrendCandidatesInVibix } from "@/lib/trend-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await checkTrendCandidatesInVibix(Math.min(100, Number(body.batchSize) || 25)));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Vibix check failed" }, { status: 500 }); }
}
