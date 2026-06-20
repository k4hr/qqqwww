"use client";

import Image from "next/image";
import Link from "next/link";
import { Film, X } from "lucide-react";
import type { ClientMovie } from "@/lib/client-watch-history";

export function LibraryMovieCard({ movie, onRemove }: { movie: ClientMovie; onRemove?: (id: string) => void }) {
  return <article className="mf-card group relative min-w-0">
    <Link href={`/watch/${movie.slug}`} aria-label={`Смотреть ${movie.title}`} className="absolute inset-0 z-10" />
    <div className="poster-fallback relative aspect-[2/3] overflow-hidden">
      {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.title} fill loading="lazy" className="object-cover transition duration-500 group-hover:scale-[1.04]" sizes="(max-width: 640px) calc(50vw - 20px), 180px" unoptimized /> : <div className="absolute inset-0 flex items-center justify-center text-[#5d5d67]"><Film size={38} /></div>}
      <span className="absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[10px] font-black text-white">{movie.year}</span>
      {onRemove ? <button type="button" aria-label={`Удалить ${movie.title}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRemove(movie.id); }} className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition hover:bg-[#e50914]"><X size={17} /></button> : null}
    </div>
    <div className="p-2.5 sm:p-3.5"><h3 className="line-clamp-2 min-h-[40px] text-sm font-black leading-5 text-white">{movie.title}</h3>{movie.kpRating || movie.imdbRating ? <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">{movie.kpRating ? <span className="card-rating"><b className="rating-kp">КП</b> {movie.kpRating.toFixed(1)}</span> : null}{movie.imdbRating ? <span className="card-rating"><b className="rating-imdb">IMDb</b> {movie.imdbRating.toFixed(1)}</span> : null}</div> : null}</div>
  </article>;
}
