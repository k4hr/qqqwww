import { ContentType } from "@prisma/client";
import { slugify } from "@/lib/slug";
import { classifyCatalogKind } from "@/lib/catalog-kind";
import type { NormalizedTmdbMovie } from "@/lib/tmdb";

type KpCountry = { country?: string | null };
type KpGenre = { genre?: string | null; name?: string | null };

type KpSearchMovie = {
  filmId?: number;
  kinopoiskId?: number;
  nameRu?: string | null;
  nameEn?: string | null;
  nameOriginal?: string | null;
  year?: string | number | null;
  type?: string | null;
  posterUrl?: string | null;
  posterUrlPreview?: string | null;
  rating?: string | number | null;
};

type KpSearchResponse = {
  films?: KpSearchMovie[];
  items?: KpSearchMovie[];
};

type KpFilmDetails = {
  kinopoiskId: number;
  nameRu?: string | null;
  nameOriginal?: string | null;
  nameEn?: string | null;
  year?: number | null;
  type?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  posterUrl?: string | null;
  posterUrlPreview?: string | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  ratingKinopoisk?: number | null;
  ratingImdb?: number | null;
  imdbId?: string | null;
  filmLength?: number | string | null;
  ratingAgeLimits?: string | null;
  countries?: KpCountry[];
  genres?: KpGenre[];
};

type KpStaff = {
  staffId?: number;
  nameRu?: string | null;
  nameEn?: string | null;
  professionKey?: string | null;
  professionText?: string | null;
};

type KpVideoResponse = {
  items?: { url?: string | null; name?: string | null; site?: string | null }[];
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

const KINOPOISK_BASE_URL = "https://kinopoiskapiunofficial.tech/api";

function getKinopoiskKey() {
  return process.env.KINOPOISK_API_KEY?.trim();
}

function compactStrings(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function mapKinopoiskType(type?: string | null, genres: string[] = []): ContentType {
  const baseType = type === "TV_SERIES" || type === "MINI_SERIES" || type === "TV_SHOW" || type === "ANIMATED_SERIES" ? ContentType.SERIES : ContentType.MOVIE;
  return classifyCatalogKind({ type: baseType, vibixType: type, vibixTags: genres });
}

async function kinopoiskFetch<T>(path: string): Promise<T> {
  const key = getKinopoiskKey();
  if (!key) throw new Error("KINOPOISK_API_KEY не указан в переменных окружения.");

  const response = await fetch(`${KINOPOISK_BASE_URL}${path}`, {
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Kinopoisk Unofficial API вернул ошибку ${response.status}${details ? `: ${details.slice(0, 180)}` : ""}.`);
  }

  return response.json() as Promise<T>;
}

function titleOf(movie: KpSearchMovie | KpFilmDetails) {
  return movie.nameRu || movie.nameOriginal || movie.nameEn || "Без названия";
}

function originalTitleOf(movie: KpSearchMovie | KpFilmDetails) {
  return movie.nameOriginal || movie.nameEn || "";
}

function parseYear(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return null;
  const year = Number(String(value).match(/\d{4}/)?.[0]);
  return Number.isFinite(year) ? year : null;
}

function parseRating(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
  if (!value) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : null;
}

function parseAge(value?: string | null) {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  return match ? `${match[0]}+` : undefined;
}

function parseDuration(value?: number | string | null) {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const str = String(value);
  const hours = Number(str.match(/(\d+)\s*ч/)?.[1] ?? 0);
  const minutes = Number(str.match(/(\d+)\s*мин/)?.[1] ?? str.match(/^(\d+)$/)?.[1] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function youtubeTrailerUrl(videos: KpVideoResponse) {
  const trailer =
    videos.items?.find((item) => item.url && item.site?.toUpperCase().includes("YOUTUBE")) ??
    videos.items?.find((item) => item.url);
  return trailer?.url ?? undefined;
}

async function getStaff(kinopoiskId: string) {
  try {
    return await kinopoiskFetch<KpStaff[]>(`/v1/staff?filmId=${encodeURIComponent(kinopoiskId)}`);
  } catch {
    return [];
  }
}

async function getVideos(kinopoiskId: string) {
  try {
    return await kinopoiskFetch<KpVideoResponse>(`/v2.2/films/${encodeURIComponent(kinopoiskId)}/videos`);
  } catch {
    return { items: [] };
  }
}

export async function searchKinopoisk(query: string): Promise<KpSearchResult[]> {
  if (!query.trim()) return [];

  const data = await kinopoiskFetch<KpSearchResponse>(
    `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query.trim())}&page=1`,
  );

  const movies = data.films ?? data.items ?? [];

  return movies.slice(0, 10).map((movie) => ({
    kinopoiskId: String(movie.filmId ?? movie.kinopoiskId),
    title: titleOf(movie),
    originalTitle: originalTitleOf(movie),
    year: parseYear(movie.year),
    posterUrl: movie.posterUrlPreview || movie.posterUrl || null,
    rating: parseRating(movie.rating),
    type: mapKinopoiskType(movie.type),
  })).filter((item) => item.kinopoiskId && item.kinopoiskId !== "undefined");
}

export async function getKinopoiskDetails(
  kinopoiskId: string,
): Promise<NormalizedTmdbMovie & { kinopoiskId: string; kpRating?: number; imdbRating?: number; ageRating?: string }> {
  const [movie, staff, videos] = await Promise.all([
    kinopoiskFetch<KpFilmDetails>(`/v2.2/films/${encodeURIComponent(kinopoiskId)}`),
    getStaff(kinopoiskId),
    getVideos(kinopoiskId),
  ]);

  const titleRu = titleOf(movie);
  const year = parseYear(movie.year) || new Date().getFullYear();

  const directors = staff.filter((person) => person.professionKey === "DIRECTOR");
  const actors = staff.filter((person) => person.professionKey === "ACTOR");

  const genres = compactStrings((movie.genres ?? []).map((genre) => genre.genre ?? genre.name));
  const cast = compactStrings(actors.map((person) => person.nameRu || person.nameEn)).slice(0, 12);
  const countries = compactStrings((movie.countries ?? []).map((item) => item.country));
  const director = compactStrings(directors.map((item) => item.nameRu || item.nameEn)).slice(0, 3).join(", ");

  return {
    titleRu,
    titleOriginal: originalTitleOf(movie) || undefined,
    description: movie.description || movie.shortDescription || "Описание будет добавлено позже.",
    year,
    type: mapKinopoiskType(movie.type, genres),
    posterUrl: movie.posterUrl || movie.posterUrlPreview || undefined,
    backdropUrl: movie.coverUrl || undefined,
    trailerUrl: youtubeTrailerUrl(videos),
    country: countries.join(", ") || undefined,
    director: director || undefined,
    duration: parseDuration(movie.filmLength),
    tmdbRating: undefined,
    tmdbId: "",
    imdbId: movie.imdbId || undefined,
    kinopoiskId: String(movie.kinopoiskId || kinopoiskId),
    kpRating: parseRating(movie.ratingKinopoisk) ?? undefined,
    imdbRating: parseRating(movie.ratingImdb) ?? undefined,
    ageRating: parseAge(movie.ratingAgeLimits),
    genres,
    cast,
    slug: `${slugify(titleRu)}-${year}`,
  };
}

type KpCollectionItem = {
  kinopoiskId?: number;
  filmId?: number;
  nameRu?: string | null;
  nameEn?: string | null;
  nameOriginal?: string | null;
};

type KpCollectionResponse = {
  items?: KpCollectionItem[];
  films?: KpCollectionItem[];
};

export async function getKinopoiskCollectionIds(collectionType: string, pages = 1) {
  const safePages = Math.max(1, Math.min(Number(pages) || 1, 5));
  const ids: string[] = [];

  for (let page = 1; page <= safePages; page += 1) {
    const data = await kinopoiskFetch<KpCollectionResponse>(
      `/v2.2/films/collections?type=${encodeURIComponent(collectionType)}&page=${page}`,
    );
    const items = data.items ?? data.films ?? [];
    for (const item of items) {
      const id = item.kinopoiskId ?? item.filmId;
      if (id) ids.push(String(id));
    }
  }

  return Array.from(new Set(ids));
}
