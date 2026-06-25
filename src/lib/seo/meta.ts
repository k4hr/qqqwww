import type { Movie } from "@prisma/client";

type MetaMovie = Pick<Movie, "titleRu" | "year" | "type" | "description" | "quality" | "kpRating" | "imdbRating"> & { genres?: Array<{ genre: { name: string } }> };

export function contentTypeLabel(type: MetaMovie["type"]) {
  if (type === "SERIES") return "сериал";
  if (type === "ANIME") return "аниме";
  if (type === "CARTOON") return "мультфильм";
  return "фильм";
}

export function watchSeoTitle(movie: MetaMovie) {
  const label = contentTypeLabel(movie.type);
  return `${movie.titleRu} (${movie.year}) смотреть онлайн бесплатно — REDFILM`;
}

export function watchSeoH1(movie: MetaMovie) {
  const label = contentTypeLabel(movie.type);
  return `Смотреть онлайн ${label} ${movie.titleRu} (${movie.year})`;
}

export function watchSeoDescription(movie: MetaMovie) {
  const label = contentTypeLabel(movie.type);
  const genres = movie.genres?.slice(0, 3).map((item) => item.genre.name.toLowerCase()).join(", ");
  const rating = movie.kpRating ? ` Рейтинг Кинопоиск ${movie.kpRating.toFixed(1)}.` : movie.imdbRating ? ` Рейтинг IMDb ${movie.imdbRating.toFixed(1)}.` : "";
  return `Смотрите ${label} ${movie.titleRu} ${movie.year} года онлайн в хорошем качестве ${movie.quality || "HD"} на REDFILM.${genres ? ` Жанры: ${genres}.` : ""}${rating}`.slice(0, 250);
}
