import type { Movie } from "@prisma/client";

type RankableMovie = Pick<Movie, "kpRating" | "imdbRating" | "quality" | "posterUrl" | "backdropUrl" | "year" | "createdAt" | "vibixUploadedAt">;

export function getMoviePopularityScore(movie: RankableMovie) {
  let score = (movie.kpRating ?? 0) * 10 + (movie.imdbRating ?? 0) * 10;
  if (movie.posterUrl) score += 15;
  if (movie.backdropUrl) score += 8;
  if (/full\s*hd|1080|\bhd\b/i.test(movie.quality)) score += 10;
  if (movie.year >= 2024) score += 8;
  else if (movie.year >= 2020) score += 4;
  if (!movie.posterUrl) score -= 30;
  return score;
}

export function getMovieFreshnessScore(movie: RankableMovie) {
  const timestamp = (movie.vibixUploadedAt ?? movie.createdAt).getTime();
  return timestamp / 86_400_000 + (movie.year >= 2024 ? 10 : 0) + (movie.posterUrl ? 2 : 0);
}

export function rankPopularMovies<T extends RankableMovie>(movies: T[], limit = 12) {
  return [...movies].sort((a, b) => getMoviePopularityScore(b) - getMoviePopularityScore(a) || getMovieFreshnessScore(b) - getMovieFreshnessScore(a)).slice(0, limit);
}
