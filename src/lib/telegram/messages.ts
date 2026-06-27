import type { Movie } from "@prisma/client";
import { getContentTypeLabel } from "@/lib/content";

export const START_MESSAGE =
  "REDFILM — фильмы и сериалы онлайн. Открой приложение, чтобы искать и смотреть фильмы прямо в Telegram.";

export const EMPTY_SEARCH_MESSAGE = "Ничего не нашёл. Попробуйте другое название.";

export function movieResultText(movie: Pick<Movie, "titleRu" | "titleOriginal" | "year" | "type" | "kpRating" | "imdbRating" | "quality">) {
  const rating = movie.kpRating ? `КП ${movie.kpRating.toFixed(1)}` : movie.imdbRating ? `IMDb ${movie.imdbRating.toFixed(1)}` : "рейтинг уточняется";
  return [
    `${movie.titleRu} (${movie.year})`,
    movie.titleOriginal ? movie.titleOriginal : null,
    `${getContentTypeLabel(movie.type)} · ${movie.quality || "HD"} · ${rating}`,
  ].filter(Boolean).join("\n");
}
