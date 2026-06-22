import { NextResponse } from "next/server";
import { createSimilarityJob, getSimilarityJobSnapshot, processSimilarityJobBatch } from "@/lib/similarity/similarity-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function boolParam(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

export async function GET() {
  const snapshot = await getSimilarityJobSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? url.searchParams.get("action") ?? "create");

  try {
    if (action === "process-once") {
      const result = await processSimilarityJobBatch();
      const snapshot = await getSimilarityJobSnapshot();
      return NextResponse.json({ ok: true, result, snapshot });
    }

    const modeParam = String(body.mode ?? url.searchParams.get("mode") ?? "DIRTY").toUpperCase();
    const mode = modeParam === "ALL" ? "ALL" : "DIRTY";
    const batchSize = Number(body.batchSize ?? url.searchParams.get("batchSize") ?? process.env.SIMILARITY_RECALCULATE_BATCH_SIZE ?? 100);
    const targetLimit = Number(body.targetLimit ?? url.searchParams.get("targetLimit") ?? 24);
    const minScore = Number(body.minScore ?? url.searchParams.get("minScore") ?? 180);
    const force = Boolean(body.force) || boolParam(url.searchParams.get("force"));

    const result = await createSimilarityJob({ mode, batchSize, targetLimit, minScore, force });
    const snapshot = await getSimilarityJobSnapshot();
    return NextResponse.json({ ok: true, result, snapshot });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Similarity job action failed" }, { status: 500 });
  }
}
