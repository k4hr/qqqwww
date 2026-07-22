import { NextResponse } from "next/server";
import { getDiscoveryRecommendations } from "@/lib/discovery/recommendations";
import {
  normalizeDiscoveryMood,
  normalizeDiscoveryPeriod,
  normalizeDiscoveryRuntime,
  normalizeDiscoveryType,
} from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mood = normalizeDiscoveryMood(url.searchParams.get("mood"));
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);
  const excludeIds = url.searchParams.getAll("exclude").slice(0, 30);
  const seed = url.searchParams.get("seed")?.slice(0, 100);
  try {
    const movies = await getDiscoveryRecommendations({
      filters: {
        mood,
        type: normalizeDiscoveryType(url.searchParams.get("type")),
        runtime: normalizeDiscoveryRuntime(url.searchParams.get("runtime")),
        period: normalizeDiscoveryPeriod(url.searchParams.get("period")),
        highRating: url.searchParams.get("highRating") === "true",
        popular: url.searchParams.get("popular") === "true",
        onlyNew: url.searchParams.get("onlyNew") === "true",
        randomGood: url.searchParams.get("randomGood") === "true",
      },
      limit: Number.isFinite(limit) ? limit : 10,
      excludeIds,
      seed,
    });
    return NextResponse.json({ mood, movies }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ mood, movies: [], message: "Подбор временно недоступен" }, { status: 503 });
  }
}
