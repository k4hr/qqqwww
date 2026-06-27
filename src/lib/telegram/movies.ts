import type { Prisma, TelegramUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { normalizeSearchQuery, searchMovies, type SearchMovie } from "@/lib/search";
import { watchPath } from "@/lib/seo-links";

export const tgMovieInclude = { genres: { include: { genre: true } } } as const;

export type TgMovie = Prisma.MovieGetPayload<{ include: typeof tgMovieInclude }>;

export function compactTgMovie(movie: Pick<TgMovie, "id" | "slug" | "titleRu" | "titleOriginal" | "year" | "type" | "posterUrl" | "backdropUrl" | "quality" | "kpRating" | "imdbRating" | "description" | "genres">) {
  return {
    id: movie.id,
    slug: movie.slug,
    titleRu: movie.titleRu,
    titleOriginal: movie.titleOriginal,
    year: movie.year,
    type: movie.type,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    quality: movie.quality,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
    description: movie.description,
    href: watchPath(movie),
    siteHref: watchPath(movie),
    genres: movie.genres.map((item) => ({ slug: item.genre.slug, name: item.genre.name })),
  };
}

export async function getTgPopularMovies(limit = 12) {
  return prisma.movie.findMany({
    where: vibixPublicMovieWhere,
    include: tgMovieInclude,
    orderBy: [{ popularScore: "desc" }, { homeScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }],
    take: limit,
  });
}

export async function getTgLatestMovies(limit = 12) {
  return prisma.movie.findMany({
    where: vibixPublicMovieWhere,
    include: tgMovieInclude,
    orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function searchTgMovies(query: string, limit = 12, user?: TelegramUser | null) {
  const movies = await searchMovies(query, {}, limit);
  await logTelegramSearch(query, movies.length, user).catch(() => null);
  return movies;
}

export async function logTelegramSearch(query: string, resultCount: number, user?: TelegramUser | null) {
  const trimmed = query.trim();
  if (!trimmed) return;
  await prisma.telegramSearchLog.create({
    data: {
      telegramUserId: user?.id,
      query: trimmed.slice(0, 300),
      normalizedQuery: normalizeSearchQuery(trimmed).slice(0, 300),
      resultCount,
    },
  });
}

export function toTgMovies(movies: Array<TgMovie | SearchMovie>) {
  return movies.map((movie) => compactTgMovie(movie));
}
