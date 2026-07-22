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
    <div className="movie-card-actions flex gap-2">
      <Link
        href={href}
        data-analytics-event="watch_click"
        data-analytics-movie-id={movie.id}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#e50914] px-3 text-xs font-black text-white shadow-[0_0_32px_rgba(229,9,20,.34)] transition hover:scale-[1.02]"
      >
        <Play size={14} fill="currentColor" /> Смотреть
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
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/10 ${favorite ? "bg-[#e50914] text-white" : "bg-black/55 text-white"} transition hover:border-[#e50914]/70`}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
      <Link
        href={similarHref}
        aria-label="Похожие"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white transition hover:border-[#e50914]/70"
      >
        <Rows3 size={16} />
      </Link>
    </div>
  );
}
