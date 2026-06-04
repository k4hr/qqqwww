import { ContentType } from "@prisma/client";
import { slugify } from "@/lib/slug";
import type { NormalizedTmdbMovie } from "@/lib/tmdb";

type KpNameItem = { name?: string | null };
type KpPerson = {
  id?: number;
  name?: string | null;
  enName?: string | null;
  profession?: string | null;
  enProfession?: string | null;
};

type KpMovie = {
  id: number;
  name?: string | null;
  alternativeName?: string | null;
  enName?: string | null;
  year?: number | null;
  type?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  poster?: { url?: string | null; previewUrl?: string | null } | null;
  backdrop?: { url?: string | null; previewUrl?: string | null } | null;
  rating?: { kp?: number | null; imdb?: number | null; tmdb?: number | null } | null;
  movieLength?: number | null;
  ageRating?: number | null;
  genres?: KpNameItem[];
  countries?: KpNameItem[];
  persons?: KpPerson[];
  videos?: { trailers?: { url?: string | null; site?: string | null; name?: string | null }[] } | null;
  externalId?: { imdb?: string | null; tmdb?: number | null } | null;
};

type KpSearchResponse = {
  docs?: KpMovie[];
};

export type KpSearchResult = {
  kinopoiskId: string;
  title: string;
  originalTitle: string;
  year: number | null;
  posterUrl: string | null;
  rating: number | null;
  type: ContentType;
};

const KINOPOISK_BASE_URL = "https://api.kinopoisk.dev/v1.4";

function getKinopoiskKey() {
  return process.env.KINOPOISK_API_KEY?.trim();
}

function mapKinopoiskType(type?: string | null): ContentType {
  if (type === "tv-series" || type === "animated-series") return ContentType.SERIES;
  if (type === "cartoon") return ContentType.CARTOON;
  if (type === "anime") return ContentType.ANIME;
  return ContentType.MOVIE;
}

async function kinopoiskFetch<T>(path: string): Promise<T> {
  const key = getKinopoiskKey();
  if (!key) throw new Error("KINOPOISK_API_KEY не указан в переменных окружения.");

  const response = await fetch(`${KINOPOISK_BASE_URL}${path}`, {
    headers: { "X-API-KEY": key },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Kinopoisk API вернул ошибку ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function titleOf(movie: KpMovie) {
  return movie.name || movie.alternativeName || movie.enName || "Без названия";
}

function youtubeTrailerUrl(movie: KpMovie) {
  const trailer = movie.videos?.trailers?.find((item) => item.url && item.site?.toLowerCase().includes("youtube"));
  return trailer?.url ?? undefined;
}

export async function searchKinopoisk(query: string): Promise<KpSearchResult[]> {
  if (!query.trim()) return [];

  const data = await kinopoiskFetch<KpSearchResponse>(
    `/movie/search?page=1&limit=10&query=${encodeURIComponent(query.trim())}`,
  );

  return (data.docs ?? []).map((movie) => ({
    kinopoiskId: String(movie.id),
    title: titleOf(movie),
    originalTitle: movie.alternativeName || movie.enName || "",
    year: movie.year ?? null,
    posterUrl: movie.poster?.previewUrl || movie.poster?.url || null,
    rating: movie.rating?.kp ? Number(movie.rating.kp.toFixed(1)) : null,
    type: mapKinopoiskType(movie.type),
  }));
}

export async function getKinopoiskDetails(kinopoiskId: string): Promise<NormalizedTmdbMovie & { kinopoiskId: string; kpRating?: number; imdbRating?: number; ageRating?: string }> {
  const movie = await kinopoiskFetch<KpMovie>(`/movie/${encodeURIComponent(kinopoiskId)}`);
  const titleRu = titleOf(movie);
  const year = movie.year || new Date().getFullYear();
  const directors = movie.persons?.filter((person) => person.enProfession === "director" || person.profession === "режиссеры") ?? [];
  const actors = movie.persons?.filter((person) => person.enProfession === "actor" || person.profession === "актеры") ?? [];

  return {
    titleRu,
    titleOriginal: movie.alternativeName || movie.enName || undefined,
    description: movie.description || movie.shortDescription || "Описание будет добавлено позже.",
    year,
    type: mapKinopoiskType(movie.type),
    posterUrl: movie.poster?.url || movie.poster?.previewUrl || undefined,
    backdropUrl: movie.backdrop?.url || movie.backdrop?.previewUrl || undefined,
    trailerUrl: youtubeTrailerUrl(movie),
    country: movie.countries?.map((item) => item.name).filter(Boolean).join(", ") || undefined,
    director: directors.map((item) => item.name || item.enName).filter(Boolean).slice(0, 3).join(", ") || undefined,
    duration: movie.movieLength || undefined,
    tmdbRating: movie.rating?.tmdb ? Number(movie.rating.tmdb.toFixed(1)) : undefined,
    tmdbId: movie.externalId?.tmdb ? String(movie.externalId.tmdb) : "",
    imdbId: movie.externalId?.imdb || undefined,
    kinopoiskId: String(movie.id),
    kpRating: movie.rating?.kp ? Number(movie.rating.kp.toFixed(1)) : undefined,
    imdbRating: movie.rating?.imdb ? Number(movie.rating.imdb.toFixed(1)) : undefined,
    ageRating: typeof movie.ageRating === "number" ? `${movie.ageRating}+` : undefined,
    genres: movie.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    cast: actors.map((person) => person.name || person.enName).filter(Boolean).slice(0, 12) as string[],
    slug: `${slugify(titleRu)}-${year}`,
  };
}
