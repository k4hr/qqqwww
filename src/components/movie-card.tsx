"use client";

import Image from "next/image";
import Link from "next/link";
import { Film, Play } from "lucide-react";
import type { Movie } from "@prisma/client";
import { watchPath } from "@/lib/seo-links";
import { trackCardClick, trackWatchClick } from "@/lib/client-analytics";

type Props = {
  movie: Pick<Movie, "id" | "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">;
};

export function MovieCard({ movie }: Props) {
  return (
    <article className="mf-card group relative block">
      <Link href={watchPath(movie)} onClick={() => trackCardClick(movie.id)} aria-label={`Смотреть: ${movie.titleRu}`} className="absolute inset-0 z-10" />
      <div className="poster-fallback relative aspect-[2/3] overflow-hidden">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={movie.titleRu}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.055] group-hover:brightness-[.52]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 210px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#52525b]">
            <Film size={42} strokeWidth={1.4} />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">REDFILM</span>
          </div>
        )}

        <span className="mf-badge absolute left-2 top-2 z-20 max-w-[calc(100%_-_16px)] truncate sm:left-3 sm:top-3">{movie.quality || "HD"}</span>
        <div className="absolute bottom-2 right-2 z-20 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur sm:bottom-3 sm:right-3 sm:text-[11px]">{movie.year}</div>
        <div className="card-hover-action pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(229,9,20,.24),rgba(0,0,0,.54))] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Link href={watchPath(movie)} onClick={() => trackWatchClick(movie.id)} className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#e50914] px-4 py-2 text-xs font-black text-white shadow-[0_0_32px_rgba(229,9,20,.42)] transition-transform hover:scale-105">
            <Play size={14} fill="currentColor" /> Смотреть
          </Link>
        </div>
      </div>

      <div className="relative p-2.5 sm:p-3.5">
        <h3 className="line-clamp-2 min-h-[40px] text-[clamp(14px,2vw,16px)] font-black leading-5 text-white transition-colors group-hover:text-[#ff4d55]">{movie.titleRu}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <span className="rounded-full border border-white/[.07] bg-black/25 px-2 py-1 text-center"><b className="rating-kp">КП</b> {movie.kpRating?.toFixed(1) ?? "—"}</span>
          <span className="rounded-full border border-white/[.07] bg-black/25 px-2 py-1 text-center"><b className="rating-imdb">IMDb</b> {movie.imdbRating?.toFixed(1) ?? "—"}</span>
        </div>
      </div>
    </article>
  );
}
