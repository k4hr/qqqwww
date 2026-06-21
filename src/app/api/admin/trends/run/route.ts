import { NextResponse } from "next/server";
import { runTrendSync } from "@/lib/trend-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedBatch = Number(body.batchSize) || Number(process.env.TREND_SYNC_BATCH_SIZE || 20);
    return NextResponse.json(await runTrendSync({ batchSize: Math.min(100, Math.max(1, requestedBatch)) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trend sync failed";
    return NextResponse.json({ error: message }, { status: message.includes("already running") ? 409 : 500 });
  }
}
