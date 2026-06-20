"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LibraryMovieCard } from "@/components/library-movie-card";
import { MovieGridSkeleton } from "@/components/movie-grid-skeleton";
import { clearFavorites, clearRecentlyWatched, getFavorites, getRecentlyWatched, LIBRARY_UPDATED_EVENT, removeFavorite, type ClientMovie } from "@/lib/client-watch-history";

type Mode = "favorites" | "history" | "recent-home";

export function ClientLibrary({ mode }: { mode: Mode }) {
  const [movies, setMovies] = useState<ClientMovie[]>([]);
  const [ready, setReady] = useState(false);
  const load = useCallback(() => {
    setMovies(mode === "favorites" ? getFavorites() : getRecentlyWatched());
    setReady(true);
  }, [mode]);

  useEffect(() => {
    load();
    window.addEventListener("storage", load);
    window.addEventListener(LIBRARY_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(LIBRARY_UPDATED_EVENT, load);
    };
  }, [load]);

  if (!ready) return mode === "recent-home" ? <MovieGridSkeleton count={6} panel /> : <MovieGridSkeleton count={8} />;
  if (mode === "recent-home" && !movies.length) return null;
  const shown = mode === "recent-home" ? movies.slice(0, 12) : movies;
  const emptyText = mode === "favorites" ? "Вы пока ничего не добавили в избранное." : "История просмотров пока пустая.";

  if (!shown.length) return <div className="mf-panel p-8 text-center"><p className="text-[#a1a1aa]">{emptyText}</p><Link href="/movies" className="mf-btn mf-btn-primary mt-5">Перейти к фильмам</Link></div>;

  if (mode === "recent-home") return <section className="mf-panel mt-8 overflow-hidden p-4 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="mf-section-title">Недавно смотрели</h2><Link href="/history" className="mf-btn">Все</Link></div><div className="movie-grid home-movie-strip">{shown.map((movie) => <LibraryMovieCard key={movie.id} movie={movie} />)}</div></section>;

  const clear = () => {
    if (mode === "favorites") clearFavorites();
    else clearRecentlyWatched();
  };
  return <><div className="mb-5 flex justify-end"><button type="button" onClick={clear} className="mf-btn">Очистить {mode === "favorites" ? "избранное" : "историю"}</button></div><div className="movie-grid">{shown.map((movie) => <LibraryMovieCard key={movie.id} movie={movie} onRemove={mode === "favorites" ? removeFavorite : undefined} />)}</div></>;
}
