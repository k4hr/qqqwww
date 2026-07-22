import { NextResponse } from "next/server";
import { getDiscoveryRecommendations, sanitizeIdList } from "@/lib/discovery/recommendations";
import type { DiscoveryFilters, MatchPreferences } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 48_000;

type MatchRequestBody = {
  excludeIds?: unknown;
  likedIds?: unknown;
  dislikedIds?: unknown;
  filters?: Partial<DiscoveryFilters>;
  preferences?: Partial<MatchPreferences>;
  seed?: unknown;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ movies: [], message: "Слишком большой запрос" }, { status: 413 });
  }

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ movies: [], message: "Слишком большой запрос" }, { status: 413 });
    const body = JSON.parse(text || "{}") as MatchRequestBody;
    const excludeIds = sanitizeIdList(body.excludeIds, 250);
    const likedIds = sanitizeIdList(body.likedIds, 80);
    const dislikedIds = sanitizeIdList(body.dislikedIds, 120);
    const seed = typeof body.seed === "string" ? body.seed.slice(0, 100) : undefined;
    const movies = await getDiscoveryRecommendations({
      filters: body.filters,
      excludeIds: [...excludeIds, ...likedIds, ...dislikedIds],
      likedIds,
      dislikedIds,
      preferences: body.preferences,
      seed,
      limit: 24,
    });
    return NextResponse.json({ movies }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Match API] Failed to build recommendation batch", error);
    return NextResponse.json({ movies: [], message: "Не удалось загрузить следующую партию" }, { status: 503 });
  }
}
