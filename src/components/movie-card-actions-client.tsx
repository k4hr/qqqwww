"use client";

import Link from "next/link";
import { Heart, Play, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite, type ClientMovieInput } from "@/lib/client-watch-history";
import { trackEvent } from "@/lib/client-analytics";

type Props = {
  movie: ClientMovieInput;
  href: string;
  similarHref: string;
};

export function MovieCardActionsClient({ movie, href, similarHref }: Props) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(isFavorite(movie.id));
  }, [movie.id]);

  return (
    <div className="movie-card-actions flex items-center justify-center gap-2">
      <Link
        href={href}
        data-analytics-event="watch_click"
        data-analytics-movie-id={movie.id}
        aria-label={`Смотреть ${movie.title}`}
        title="Смотреть"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--rf-red)] text-white shadow-[0_8px_22px_rgba(0,0,0,.38)] transition hover:bg-[var(--rf-red-hover)]"
      >
        <Play size={16} fill="currentColor" />
      </Link>
      <button
        type="button"
        aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
        aria-pressed={favorite}
        onClick={() => {
          const next = toggleFavorite(movie);
          setFavorite(next);
          trackEvent("favorite_toggle", { movieId: movie.id });
        }}
        title={favorite ? "Убрать из избранного" : "В избранное"}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 ${favorite ? "bg-[var(--rf-red)] text-white" : "bg-black/72 text-white"} backdrop-blur-md transition hover:border-white/25`}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
      <Link
        href={similarHref}
        aria-label="Похожие"
        title="Похожие"
        className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/72 text-white backdrop-blur-md transition hover:border-white/25 md:inline-flex"
      >
        <Rows3 size={16} />
      </Link>
    </div>
  );
}
