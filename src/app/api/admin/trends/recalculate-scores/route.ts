import { NextResponse } from "next/server";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { recalculateAllHomeScores } from "@/lib/trend-engine";

export async function POST() {
  try {
    const home = await recalculateAllHomeScores();
    const catalog = await recalculateAllCatalogScores();
    return NextResponse.json({ home, catalog });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Recalculation failed" }, { status: 500 }); }
}
