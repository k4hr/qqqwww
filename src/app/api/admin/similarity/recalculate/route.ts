import { NextResponse } from "next/server";
import { recalculateMovieSimilarities } from "@/lib/similarity/recalculate-similarities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 300), 5000));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const targetLimit = Math.max(6, Math.min(Number(url.searchParams.get("targetLimit") || 24), 60));
  const sourceMovieId = url.searchParams.get("sourceMovieId") || undefined;

  try {
    const result = await recalculateMovieSimilarities({ limit, offset, targetLimit, sourceMovieId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Similarity recalculation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
