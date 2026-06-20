import type { Movie } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getMovieFreshnessScore, getMoviePopularityScore } from "@/lib/catalog-rank";
import { prisma } from "@/lib/prisma";

export type MoviePopularityStats = {
  pageView: number;
  playerView: number;
  watchClick: number;
  cardClick: number;
  similarClick: number;
  total: number;
};

export type PopularityStats = Map<string, MoviePopularityStats>;

type PopularMovie = Pick<Movie, "id" | "kpRating" | "imdbRating" | "quality" | "posterUrl" | "backdropUrl" | "year" | "createdAt" | "vibixUploadedAt">;

function emptyStats(): MoviePopularityStats {
  return { pageView: 0, playerView: 0, watchClick: 0, cardClick: 0, similarClick: 0, total: 0 };
}

const getPopularityRows = unstable_cache(async (days: number) => prisma.movieEvent.groupBy({
  by: ["movieId", "type"],
  where: { movieId: { not: null }, createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
  _count: { _all: true },
}), ["redfilm-popularity-events"], { revalidate: 300 });

export async function getRecentPopularityStats(days = 7): Promise<PopularityStats> {
  try {
    const rows = await getPopularityRows(days);
    const stats: PopularityStats = new Map();
    for (const row of rows) {
      if (!row.movieId) continue;
      const item = stats.get(row.movieId) ?? emptyStats();
      const count = row._count._all;
      if (row.type === "page_view") item.pageView += count;
      if (row.type === "player_view") item.playerView += count;
      if (row.type === "watch_click") item.watchClick += count;
      if (row.type === "card_click") item.cardClick += count;
      if (row.type === "similar_click") item.similarClick += count;
      item.total += count;
      stats.set(row.movieId, item);
    }
    return stats;
  } catch {
    return new Map();
  }
}

export function getRealPopularityScore(movie: PopularMovie, stats?: MoviePopularityStats) {
  if (!stats?.total) return getMoviePopularityScore(movie);
  const behavior = stats.pageView + stats.playerView * 3 + (stats.watchClick + stats.cardClick) * 2 + stats.similarClick;
  const ratingBonus = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0) * 2;
  const freshnessBonus = movie.year >= new Date().getFullYear() - 1 ? 8 : movie.year >= 2020 ? 3 : 0;
  return behavior + ratingBonus + freshnessBonus;
}

export function getPopularMovies<T extends PopularMovie>(movies: T[], stats: PopularityStats, limit = 12) {
  return [...movies].sort((a, b) => getRealPopularityScore(b, stats.get(b.id)) - getRealPopularityScore(a, stats.get(a.id)) || getMovieFreshnessScore(b) - getMovieFreshnessScore(a)).slice(0, limit);
}

export function getTrendingMovies<T extends PopularMovie>(movies: T[], stats: PopularityStats, limit = 12) {
  return getPopularMovies(movies, stats, limit);
}
