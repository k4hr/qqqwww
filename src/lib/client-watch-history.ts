"use client";

export type ClientMovie = {
  id: string;
  slug: string;
  title: string;
  year: number;
  posterUrl: string | null;
  type: string;
  kpRating: number | null;
  imdbRating: number | null;
  watchedAt: string;
};

export type ClientMovieInput = Omit<ClientMovie, "watchedAt">;

const RECENT_KEY = "redfilm:recently-watched:v1";
const FAVORITES_KEY = "redfilm:favorites:v1";
export const LIBRARY_UPDATED_EVENT = "redfilm:library-updated";

function isClientMovie(value: unknown): value is ClientMovie {
  if (!value || typeof value !== "object") return false;
  const movie = value as Partial<ClientMovie>;
  return typeof movie.id === "string" && typeof movie.slug === "string" && typeof movie.title === "string" && typeof movie.year === "number";
}

function read(key: string): ClientMovie[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isClientMovie) : [];
  } catch {
    return [];
  }
}

function write(key: string, movies: ClientMovie[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(movies));
    window.dispatchEvent(new CustomEvent(LIBRARY_UPDATED_EVENT, { detail: { key } }));
  } catch {
    // Private mode and storage quotas must not affect navigation.
  }
}

function newest(movie: ClientMovieInput): ClientMovie {
  return { ...movie, watchedAt: new Date().toISOString() };
}

export function addRecentlyWatched(movie: ClientMovieInput) {
  write(RECENT_KEY, [newest(movie), ...read(RECENT_KEY).filter((item) => item.id !== movie.id)].slice(0, 20));
}

export function getRecentlyWatched() { return read(RECENT_KEY); }
export function clearRecentlyWatched() { write(RECENT_KEY, []); }

export function addFavorite(movie: ClientMovieInput) {
  write(FAVORITES_KEY, [newest(movie), ...read(FAVORITES_KEY).filter((item) => item.id !== movie.id)].slice(0, 100));
}

export function removeFavorite(movieId: string) {
  write(FAVORITES_KEY, read(FAVORITES_KEY).filter((item) => item.id !== movieId));
}

export function toggleFavorite(movie: ClientMovieInput) {
  if (isFavorite(movie.id)) {
    removeFavorite(movie.id);
    return false;
  }
  addFavorite(movie);
  return true;
}

export function isFavorite(movieId: string) { return read(FAVORITES_KEY).some((item) => item.id === movieId); }
export function getFavorites() { return read(FAVORITES_KEY); }
export function clearFavorites() { write(FAVORITES_KEY, []); }
