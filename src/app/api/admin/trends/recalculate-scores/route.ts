import { NextResponse } from "next/server";
import { recalculateAllHomeScores } from "@/lib/trend-engine";

export async function POST() {
  try { return NextResponse.json(await recalculateAllHomeScores()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Recalculation failed" }, { status: 500 }); }
}
