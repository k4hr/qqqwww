import { NextResponse } from "next/server";
import { publicCollections } from "@/lib/collections";
import { normalizeSearchQuery, searchMovies } from "@/lib/search";
import { seasonPath, watchPath } from "@/lib/seo-links";
import { parseSearchIntent } from "@/lib/search-v2";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = normalizeSearchQuery(new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  if (query.length < 2) return NextResponse.json({ results: [], groups: [] });
  try {
    const parsed = parseSearchIntent(query);
    const movies = await searchMovies(query, {}, 24, "SUGGEST");
    const movieResults = movies.map((movie) => ({
      id: movie.id,
      title: movie.titleRu,
      originalTitle: movie.titleOriginal,
      year: movie.year,
      type: movie.type,
      posterUrl: movie.posterUrl,
      season: parsed.season?.season,
      seasonAvailable: parsed.season ? (movie.vibixSeasonCount ?? 0) >= parsed.season.season : false,
      href: parsed.season && (movie.vibixSeasonCount ?? 0) >= parsed.season.season ? seasonPath(movie, parsed.season.season) : watchPath(movie),
    }));
    const byType = [
      { key: "movies", title: "Фильмы", href: `/search?q=${encodeURIComponent(query)}&type=MOVIE`, results: movieResults.filter((movie) => movie.type === "MOVIE").slice(0, 4) },
      { key: "series", title: "Сериалы", href: `/search?q=${encodeURIComponent(query)}&type=SERIES`, results: movieResults.filter((movie) => movie.type === "SERIES").slice(0, 4) },
      { key: "cartoons", title: "Мультфильмы", href: `/search?q=${encodeURIComponent(query)}&type=CARTOON`, results: movieResults.filter((movie) => movie.type === "CARTOON").slice(0, 4) },
      { key: "anime", title: "Аниме", href: `/search?q=${encodeURIComponent(query)}&type=ANIME`, results: movieResults.filter((movie) => movie.type === "ANIME").slice(0, 4) },
    ];
    const collectionResults = publicCollections
      .filter((collection) => normalizeSearchQuery(collection.h1).includes(query))
      .slice(0, 4)
      .map((collection) => ({
        id: `collection-${collection.slug}`,
        title: collection.h1,
        year: new Date().getFullYear(),
        type: "COLLECTION",
        posterUrl: null,
        href: `/collections/${collection.slug}`,
      }));
    const groups = [
      ...byType.filter((group) => group.results.length > 0),
      ...(collectionResults.length ? [{ key: "collections", title: "Подборки", href: `/collections`, results: collectionResults }] : []),
    ];
    return NextResponse.json({
      results: movieResults.slice(0, 8),
      groups,
    });
  } catch {
    return NextResponse.json({ results: [], groups: [] });
  }
}
