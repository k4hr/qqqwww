import { NextResponse } from "next/server";
import { runVibixUpdateWatcher } from "@/lib/vibix-update-watcher";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { recalculateAllHomeScores } from "@/lib/trend-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const update = await runVibixUpdateWatcher({
      pagesPerRun: Number(body.pagesPerRun || body.pages || process.env.VIBIX_UPDATE_PAGES_PER_RUN || 5),
      limit: Number(body.limit || process.env.VIBIX_UPDATE_LIMIT || 50),
      detailLimit: Number(body.detailLimit || process.env.VIBIX_UPDATE_DETAIL_LIMIT || 100),
    });
    const catalog = await recalculateAllCatalogScores();
    const home = await recalculateAllHomeScores();
    return NextResponse.json({ update, catalog, home });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vibix update failed" }, { status: 500 });
  }
}
