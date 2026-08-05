import { NextRequest, NextResponse } from "next/server";
import {
  getMovieDurationBackfillState,
  pauseMovieDurationBackfill,
  resetMovieDurationBackfill,
  runMovieDurationBackfillIteration,
  startMovieDurationBackfill,
} from "@/lib/movie-duration-backfill";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ state: await getMovieDurationBackfillState() });
  } catch (error) {
    console.error("[DurationBackfill] Failed to read state", error);
    return NextResponse.json({ error: "Не удалось получить состояние заполнения длительности" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; batchSize?: number };
    const action = String(body.action ?? "").toUpperCase();
    const batchSize = Number.isFinite(Number(body.batchSize)) ? Number(body.batchSize) : undefined;

    if (action === "START") {
      return NextResponse.json({ state: await startMovieDurationBackfill(batchSize) });
    }
    if (action === "PAUSE") {
      return NextResponse.json({ state: await pauseMovieDurationBackfill() });
    }
    if (action === "RESET") {
      return NextResponse.json({ state: await resetMovieDurationBackfill() });
    }
    if (action === "RUN_ONCE") {
      const result = await runMovieDurationBackfillIteration({ force: true });
      const state = ["QUEUED", "RUNNING"].includes(result.status)
        ? await pauseMovieDurationBackfill()
        : result;
      return NextResponse.json({ state });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("[DurationBackfill] Action failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка заполнения длительности" }, { status: 500 });
  }
}
