import { NextResponse } from "next/server";
import { debugMovieSimilarity } from "@/lib/similarity/recalculate-similarities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 20), 80));
  if (!q) return NextResponse.json({ ok: false, error: "Query q is required" }, { status: 400 });

  const result = await debugMovieSimilarity(q, limit);
  if (!result) return NextResponse.json({ ok: false, error: "Movie not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
}
