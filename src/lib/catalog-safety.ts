import type { Movie, Prisma } from "@prisma/client";
import { isLowPriorityCountry } from "@/lib/catalog-filters";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

type HomeCatalogMovie = Pick<Movie, "titleRu" | "titleOriginal" | "description" | "country" | "posterUrl">;

const ADULT_MARKERS = [
  "секс", "порно", "эротик", "эротика", "интим", "18+", "xxx", "анал", "анальный", "голые", "обнаж", "разврат",
  "sex", "porn", "erotic", "erotica", "adult", "nude", "naked", "anal", "hardcore",
] as const;

function normalizeText(value?: string | null) {
  return (value ?? "").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function isAdultLikeTitle(movie: Pick<HomeCatalogMovie, "titleRu" | "titleOriginal" | "description">) {
  const searchable = normalizeText([movie.titleRu, movie.titleOriginal, movie.description].filter(Boolean).join(" \n "));
  return ADULT_MARKERS.some((marker) => {
    if (/^[a-z]+$/.test(marker)) return new RegExp(`(^|[^a-z])${marker}([^a-z]|$)`, "i").test(searchable);
    return searchable.includes(marker);
  });
}

export function isValidHomePoster(url?: string | null) {
  const normalized = url?.trim().toLowerCase();
  if (!normalized) return false;
  return !normalized.includes("placeholder") && !normalized.includes("redfilm-hero") && !normalized.includes("redfilm-placeholder");
}

export function isSafeForHome(movie: HomeCatalogMovie) {
  return isValidHomePoster(movie.posterUrl) && !isLowPriorityCountry(movie.country) && !isAdultLikeTitle(movie);
}

export function buildHomeCatalogWhere(): Prisma.MovieWhereInput {
  return {
    AND: [
      vibixPublicMovieWhere,
      { isCatalogAllowed: true },
      { posterUrl: { not: null } },
      { posterUrl: { not: "" } },
    ],
  };
}
