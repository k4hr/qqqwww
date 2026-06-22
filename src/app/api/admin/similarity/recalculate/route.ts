import { NextResponse } from "next/server";
import { recalculateMovieSimilarities } from "@/lib/similarity/recalculate-similarities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecalculateMethod = "GET" | "POST";

async function handleRecalculate(request: Request, method: RecalculateMethod) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 300), 5000));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const targetLimit = Math.max(6, Math.min(Number(url.searchParams.get("targetLimit") || 24), 60));
  const sourceMovieId = url.searchParams.get("sourceMovieId") || undefined;

  try {
    const result = await recalculateMovieSimilarities({ limit, offset, targetLimit, sourceMovieId });
    return NextResponse.json({ ok: true, method, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Similarity recalculation failed";
    return NextResponse.json({ ok: false, method, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleRecalculate(request, "POST");
}

export async function GET(request: Request) {
  return handleRecalculate(request, "GET");
}
