"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { ArtworkPlaceholder, isGenericRedfilmArtwork } from "@/components/artwork-placeholder";
import type { ClientMovie } from "@/lib/client-watch-history";

export function LibraryMovieCard({ movie, onRemove }: { movie: ClientMovie; onRemove?: (id: string) => void }) {
  const hasPoster = !isGenericRedfilmArtwork(movie.posterUrl);
  const rating = movie.kpRating ?? movie.imdbRating;

  return <article className="mf-card group relative min-w-0">
    <Link href={`/watch/${movie.slug}`} aria-label={`Смотреть ${movie.title}`} className="absolute inset-0 z-10" />
    <div className="rf-poster-shell relative aspect-[2/3]">
      {hasPoster ? <Image src={movie.posterUrl!} alt={movie.title} fill loading="lazy" className="object-cover transition duration-500 group-hover:scale-[1.025] group-hover:brightness-[.84]" sizes="(max-width: 640px) calc(50vw - 20px), 180px" quality={68} /> : <ArtworkPlaceholder title={movie.title} />}
      {rating ? <span className="rf-card-rating absolute left-2.5 top-2.5">{rating.toFixed(1)}</span> : null}
      {onRemove ? <button type="button" aria-label={`Удалить ${movie.title}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRemove(movie.id); }} className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition hover:bg-[#e50914]"><X size={17} /></button> : null}
    </div>
    <div className="pt-2.5"><h3 className="rf-card-title line-clamp-2">{movie.title}</h3><div className="rf-card-meta mt-1.5">{movie.year}</div></div>
  </article>;
}
