import { NextResponse } from "next/server";
import { getDiscoveryRecommendations } from "@/lib/discovery/recommendations";
import { normalizeDiscoveryMood } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mood = normalizeDiscoveryMood(url.searchParams.get("mood"));
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);
  try {
    const movies = await getDiscoveryRecommendations({ mood, limit: Number.isFinite(limit) ? limit : 10 });
    return NextResponse.json({ mood, movies });
  } catch {
    return NextResponse.json({ mood, movies: [] }, { status: 503 });
  }
}
