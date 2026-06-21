import { NextResponse } from "next/server";
import { enrichExistingVibixMovies } from "@/lib/trend-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(200, Math.max(1, Number(body.batchSize) || Number(process.env.TREND_ENRICH_BATCH_SIZE || 50)));
    return NextResponse.json(await enrichExistingVibixMovies({ batchSize }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vibix enrichment failed" }, { status: 500 });
  }
}
