import { NextResponse } from "next/server";
import { normalizeSearchQuery, searchMovies } from "@/lib/search";
import { watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = normalizeSearchQuery(new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  if (query.length < 2) return NextResponse.json({ results: [] });
  try {
    const movies = await searchMovies(query, {}, 8);
    return NextResponse.json({
      results: movies.map((movie) => ({
        id: movie.id,
        title: movie.titleRu,
        year: movie.year,
        type: movie.type,
        posterUrl: movie.posterUrl,
        href: watchPath(movie),
      })),
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
