"use client";

import Image from "next/image";
import Link from "next/link";
import { RotateCcw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MovieCard } from "@/components/movie-card";
import { toggleFavorite } from "@/lib/client-watch-history";
import { trackEvent } from "@/lib/client-analytics";
import type { DiscoveryMovie } from "@/lib/discovery/types";
import { watchPath } from "@/lib/seo-links";

const PREFS_KEY = "redfilm:match:preferences:v1";
const HISTORY_KEY = "redfilm:match:history:v1";

type MatchPreferences = {
  liked: string[];
  disliked: string[];
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
    return parsed && typeof parsed === "object" ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local preferences are optional.
  }
}

export function MatchDeckClient({ movies }: { movies: DiscoveryMovie[] }) {
  const [preferences, setPreferences] = useState<MatchPreferences>({ liked: [], disliked: [] });
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setPreferences(readStorage(PREFS_KEY, { liked: [], disliked: [] }));
    setHistory(readStorage(HISTORY_KEY, []));
  }, []);

  const visibleMovies = useMemo(() => {
    const seen = new Set([...preferences.liked, ...preferences.disliked, ...history]);
    return movies.filter((movie) => !seen.has(movie.id));
  }, [history, movies, preferences.disliked, preferences.liked]);

  const activeMovie = visibleMovies[0] ?? movies[0];
  const nextMovies = visibleMovies.slice(1, 7);

  function updatePreference(movieId: string, action: "like" | "dislike") {
    setPreferences((current) => {
      const next = {
        liked: action === "like" ? [movieId, ...current.liked.filter((id) => id !== movieId)].slice(0, 80) : current.liked.filter((id) => id !== movieId),
        disliked: action === "dislike" ? [movieId, ...current.disliked.filter((id) => id !== movieId)].slice(0, 120) : current.disliked.filter((id) => id !== movieId),
      };
      writeStorage(PREFS_KEY, next);
      return next;
    });
    setHistory((current) => {
      const next = [movieId, ...current.filter((id) => id !== movieId)].slice(0, 180);
      writeStorage(HISTORY_KEY, next);
      return next;
    });
    trackEvent(action === "like" ? "match_like" : "match_dislike", { movieId });
  }

  function reset() {
    const next = { liked: [], disliked: [] };
    setPreferences(next);
    setHistory([]);
    writeStorage(PREFS_KEY, next);
    writeStorage(HISTORY_KEY, []);
    trackEvent("match_reset");
  }

  if (!movies.length) {
    return (
      <div className="mf-panel p-6 text-[#a1a1aa]">
        Пока не удалось собрать достаточно фильмов для Match. Каталог продолжит работать через обычные разделы.
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mf-panel overflow-hidden p-0">
        {activeMovie ? (
          <div className="relative min-h-[560px] overflow-hidden">
            <Image src="/redfilm-hero.webp" alt="" fill sizes="(max-width: 1024px) 100vw, 760px" className="object-cover opacity-35" priority />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(229,9,20,.24),transparent_34%),linear-gradient(90deg,rgba(5,5,8,.98),rgba(5,5,8,.74))]" />
            <div className="relative z-10 grid min-h-[560px] gap-6 p-5 sm:p-8 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
              <div className="poster-fallback relative mx-auto aspect-[2/3] w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,.62)]">
                {activeMovie.posterUrl ? <Image src={activeMovie.posterUrl} alt={activeMovie.titleRu} fill sizes="260px" className="object-cover" priority /> : null}
              </div>
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-[#ff4d55]">
                  <Star size={14} /> REDFILM Match
                </div>
                <h2 className="text-[clamp(2rem,7vw,4rem)] font-black leading-none tracking-[-.055em] text-white">{activeMovie.titleRu}</h2>
                <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
                  <span className="mf-badge">{activeMovie.quality || "HD"}</span>
                  <span className="mf-pill min-h-[28px] px-3">{activeMovie.year}</span>
                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-kp">КП</b> {activeMovie.kpRating?.toFixed(1) ?? "—"}</span>
                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-imdb">IMDb</b> {activeMovie.imdbRating?.toFixed(1) ?? "—"}</span>
                </div>
                <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-7 text-[#d4d4d8]">{activeMovie.description}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => updatePreference(activeMovie.id, "dislike")} className="mf-btn gap-2"><ThumbsDown size={17} /> Не сейчас</button>
                  <button type="button" onClick={() => updatePreference(activeMovie.id, "like")} className="mf-btn gap-2"><ThumbsUp size={17} /> Нравится</button>
                  <button type="button" onClick={() => {
                    toggleFavorite({ id: activeMovie.id, slug: activeMovie.slug, title: activeMovie.titleRu, year: activeMovie.year, posterUrl: activeMovie.posterUrl, type: activeMovie.type, kpRating: activeMovie.kpRating, imdbRating: activeMovie.imdbRating });
                    trackEvent("match_favorite", { movieId: activeMovie.id });
                  }} className="mf-btn">В избранное</button>
                  <Link href={watchPath(activeMovie)} onClick={() => trackEvent("match_watch", { movieId: activeMovie.id })} className="mf-btn mf-btn-primary">Смотреть</Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="grid content-start gap-4">
        <div className="mf-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">Очередь</h2>
            <button type="button" onClick={reset} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white" aria-label="Сбросить Match">
              <RotateCcw size={17} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">Лайки и пропуски хранятся только в вашем браузере и помогают не показывать одно и то же.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {nextMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      </aside>
    </section>
  );
}
