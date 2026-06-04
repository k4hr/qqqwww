import { ContentType } from "@prisma/client";
import { slugify } from "@/lib/slug";

type TmdbGenre = { id: number; name: string };
type TmdbPerson = { id: number; name: string; original_name?: string; character?: string; job?: string };

type TmdbDetails = {
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
  genres?: TmdbGenre[];
  origin_country?: string[];
  production_countries?: { name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  vote_average?: number;
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
  credits?: {
    cast?: TmdbPerson[];
    crew?: TmdbPerson[];
  };
  videos?: {
    results?: { key: string; site: string; type: string; official?: boolean }[];
  };
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
  tmdbId: string;
  imdbId?: string;
  genres: string[];
  cast: string[];
  slug: string;
};

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

function getTmdbKey() {
  return process.env.TMDB_API_KEY?.trim();
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const key = getTmdbKey();
  if (!key) throw new Error("TMDB_API_KEY не указан в переменных окружения.");

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${TMDB_BASE_URL}${path}${separator}api_key=${key}`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`TMDB API вернул ошибку ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function searchTmdb(query: string, type: ContentType) {
  const endpoint = type === ContentType.SERIES ? "tv" : "movie";
  const data = await tmdbFetch<{ results: TmdbDetails[] }>(
    `/search/${endpoint}?language=ru-RU&include_adult=false&query=${encodeURIComponent(query)}`,
  );

  return data.results.slice(0, 10).map((item) => ({
    tmdbId: String(item.id),
    title: item.title ?? item.name ?? "Без названия",
    originalTitle: item.original_title ?? item.original_name ?? "",
    year: Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || null,
    posterUrl: item.poster_path ? `${IMAGE_BASE_URL}/w300${item.poster_path}` : null,
  }));
}

export async function getTmdbDetails(tmdbId: string, type: ContentType): Promise<NormalizedTmdbMovie> {
  const endpoint = type === ContentType.SERIES ? "tv" : "movie";
  const details = await tmdbFetch<TmdbDetails>(
    `/${endpoint}/${tmdbId}?language=ru-RU&append_to_response=credits,videos,external_ids`,
  );

  const titleRu = details.title ?? details.name ?? "Без названия";
  const titleOriginal = details.original_title ?? details.original_name ?? titleRu;
  const year = Number((details.release_date ?? details.first_air_date ?? "").slice(0, 4)) || new Date().getFullYear();
  const director = details.credits?.crew?.find((person) => person.job === "Director")?.name;
  const trailer = details.videos?.results?.find(
    (video) => video.site === "YouTube" && (video.type === "Trailer" || video.official),
  );

  return {
    titleRu,
    titleOriginal,
    description: details.overview || "Описание будет добавлено позже.",
    year,
    type,
    posterUrl: details.poster_path ? `${IMAGE_BASE_URL}/w500${details.poster_path}` : undefined,
    backdropUrl: details.backdrop_path ? `${IMAGE_BASE_URL}/w1280${details.backdrop_path}` : undefined,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    country: details.production_countries?.[0]?.name ?? details.origin_country?.[0],
    director,
    duration: details.runtime ?? details.episode_run_time?.[0],
    tmdbRating: details.vote_average ? Number(details.vote_average.toFixed(1)) : undefined,
    tmdbId: String(details.id),
    imdbId: details.imdb_id ?? details.external_ids?.imdb_id ?? undefined,
    genres: details.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    cast: details.credits?.cast?.slice(0, 10).map((person) => person.name).filter(Boolean) ?? [],
    slug: `${slugify(titleRu)}-${year}`,
  };
}
