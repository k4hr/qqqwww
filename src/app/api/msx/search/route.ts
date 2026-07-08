import { NextRequest, NextResponse } from "next/server";
import { normalizeSearchQuery } from "@/lib/search";
import { searchTvMovies, serializeTvMovie } from "@/lib/tv";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const movies = query ? await searchTvMovies(query, 48) : [];
  return NextResponse.json({
    ok: true,
    query,
    count: movies.length,
    movies: movies.map(serializeTvMovie),
  }, {
    headers: {
      "Cache-Control": query ? "public, s-maxage=60, stale-while-revalidate=600" : "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
