import { ContentType } from "@prisma/client";
import { slugify } from "@/lib/slug";

type TmdbGenre = { id: number; name: string };
type TmdbPerson = { id: number; name: string; original_name?: string; character?: string; job?: string; popularity?: number };

export type TmdbSummary = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  media_type?: "movie" | "tv";
};

type TmdbDetails = TmdbSummary & {
  genres?: TmdbGenre[];
  origin_country?: string[];
  production_countries?: { name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
  belongs_to_collection?: { id: number; name: string } | null;
  credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
  videos?: { results?: { key: string; site: string; type: string; official?: boolean }[] };
};

export type NormalizedTmdbMovie = {
  titleRu: string;
  titleOriginal?: string;
  description: string;
  year: number;
  type: ContentType;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  country?: string;
  director?: string;
  duration?: number;
  tmdbRating?: number;
  tmdbVotes?: number;
  tmdbPopularity?: number;
  collectionId?: number;
  tmdbId: string;
  imdbId?: string;
  genres: string[];
  cast: string[];
  castPopularity?: number;
  slug: string;
};

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

function getTmdbKey() {
  return process.env.TMDB_API_KEY?.trim();
}

async function tmdbFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const key = getTmdbKey();
  if (!key) throw new Error("TMDB_API_KEY не указан в переменных окружения.");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${TMDB_BASE_URL}${path}${separator}api_key=${key}`, { next: { revalidate } });
  if (!response.ok) throw new Error(`TMDB API вернул ошибку ${response.status}.`);
  return response.json() as Promise<T>;
}

async function list(path: string) {
  return (await tmdbFetch<{ results: TmdbSummary[] }>(path)).results ?? [];
}

export function tmdbImage(path?: string | null, size = "w500") {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : undefined;
}

export async function getTrendingMovies(period: "day" | "week" = "week") {
  return list(`/trending/movie/${period}?language=ru-RU`);
}

export async function getTrendingSeries(period: "day" | "week" = "week") {
  return list(`/trending/tv/${period}?language=ru-RU`);
}

export const getTrendingTv = getTrendingSeries;

export async function discoverTmdb(type: ContentType, params: Record<string, string | number | boolean>) {
  const endpoint = type === ContentType.SERIES ? "tv" : "movie";
  const query = new URLSearchParams({ language: "ru-RU", include_adult: "false" });
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));
  return list(`/discover/${endpoint}?${query}`);
}

export async function getPopularByYear(type: ContentType, year: number) {
  const key = type === ContentType.SERIES ? "first_air_date_year" : "primary_release_year";
  return discoverTmdb(type, { [key]: year, sort_by: "popularity.desc", "vote_count.gte": 25 });
}

export async function getTopRatedByYear(type: ContentType, year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const prefix = type === ContentType.SERIES ? "first_air_date" : "primary_release_date";
  return discoverTmdb(type, { [`${prefix}.gte`]: from, [`${prefix}.lte`]: to, sort_by: "vote_average.desc", "vote_count.gte": 200 });
}

export const discoverPopularMoviesByYear = (year: number) => getPopularByYear(ContentType.MOVIE, year);
export const discoverPopularTvByYear = (year: number) => getPopularByYear(ContentType.SERIES, year);
export const discoverTopRatedMoviesByYear = (year: number) => getTopRatedByYear(ContentType.MOVIE, year);
export const discoverTopRatedTvByYear = (year: number) => getTopRatedByYear(ContentType.SERIES, year);
export const discoverByCompany = (companyId: string | number, type: "movie" | "tv") => discoverTmdb(type === "tv" ? ContentType.SERIES : ContentType.MOVIE, { with_companies: companyId });
export const discoverByNetwork = (networkId: string | number) => discoverTmdb(ContentType.SERIES, { with_networks: networkId });
export const discoverByKeyword = (keywordId: string | number, type: "movie" | "tv") => discoverTmdb(type === "tv" ? ContentType.SERIES : ContentType.MOVIE, { with_keywords: keywordId });
export async function discoverByPerson(personId: string | number, type: "movie" | "tv") {
  const data = await tmdbFetch<{ cast?: TmdbSummary[] }>(`/person/${personId}/combined_credits?language=ru-RU`);
  return (data.cast ?? []).filter((item) => item.media_type === type);
}

export async function searchTmdb(query: string, type: ContentType) {
  const endpoint = type === ContentType.SERIES ? "tv" : "movie";
  const data = await list(`/search/${endpoint}?language=ru-RU&include_adult=false&query=${encodeURIComponent(query)}`);
  return data.slice(0, 10).map((item) => ({
    tmdbId: String(item.id),
    title: item.title ?? item.name ?? "Без названия",
    originalTitle: item.original_title ?? item.original_name ?? "",
    year: Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || null,
    posterUrl: tmdbImage(item.poster_path, "w300") ?? null,
  }));
}

export async function searchTmdbEntity(kind: "company" | "keyword" | "person" | "collection", query: string) {
  return list(`/search/${kind}?language=ru-RU&query=${encodeURIComponent(query)}`);
}

export async function getTmdbCollection(collectionId: number) {
  const data = await tmdbFetch<{ parts?: TmdbSummary[] }>(`/collection/${collectionId}?language=ru-RU`);
  return data.parts ?? [];
}

export const getCollectionItems = (collectionId: string | number) => getTmdbCollection(Number(collectionId));

export async function searchMovieByTitle(title: string, year?: number) {
  const query = new URLSearchParams({ language: "ru-RU", include_adult: "false", query: title });
  if (year) query.set("year", String(year));
  return list(`/search/movie?${query}`);
}

export async function searchTvByTitle(title: string, year?: number) {
  const query = new URLSearchParams({ language: "ru-RU", include_adult: "false", query: title });
  if (year) query.set("first_air_date_year", String(year));
  return list(`/search/tv?${query}`);
}

export async function getTmdbDetails(tmdbId: string, type: ContentType): Promise<NormalizedTmdbMovie> {
  const endpoint = type === ContentType.SERIES ? "tv" : "movie";
  const details = await tmdbFetch<TmdbDetails>(`/${endpoint}/${tmdbId}?language=ru-RU&append_to_response=credits,videos,external_ids,images`);
  const titleRu = details.title ?? details.name ?? "Без названия";
  const titleOriginal = details.original_title ?? details.original_name ?? titleRu;
  const year = Number((details.release_date ?? details.first_air_date ?? "").slice(0, 4)) || new Date().getFullYear();
  const director = details.credits?.crew?.find((person) => person.job === "Director")?.name;
  const trailer = details.videos?.results?.find((video) => video.site === "YouTube" && (video.type === "Trailer" || video.official));
  return {
    titleRu,
    titleOriginal,
    description: details.overview || "Описание будет добавлено позже.",
    year,
    type,
    posterUrl: tmdbImage(details.poster_path),
    backdropUrl: tmdbImage(details.backdrop_path, "w1280"),
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    country: details.production_countries?.map((country) => country.name).filter(Boolean).join(", ") || details.origin_country?.join(", "),
    director,
    duration: details.runtime ?? details.episode_run_time?.[0],
    tmdbRating: details.vote_average ? Number(details.vote_average.toFixed(1)) : undefined,
    tmdbVotes: details.vote_count,
    tmdbPopularity: details.popularity,
    collectionId: details.belongs_to_collection?.id,
    tmdbId: String(details.id),
    imdbId: details.imdb_id ?? details.external_ids?.imdb_id ?? undefined,
    genres: details.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    cast: details.credits?.cast?.slice(0, 10).map((person) => person.name).filter(Boolean) ?? [],
    castPopularity: details.credits?.cast?.slice(0, 10).reduce((total, person) => total + Math.log10(1 + (person.popularity ?? 0)), 0),
    slug: `${slugify(titleRu)}-${year}`,
  };
}

export const getDetailsWithExternalIds = (tmdbId: string | number, type: "movie" | "tv") => getTmdbDetails(String(tmdbId), type === "tv" ? ContentType.SERIES : ContentType.MOVIE);
