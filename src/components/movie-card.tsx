import Link from "next/link";
import Image from "next/image";
import type { Movie } from "@prisma/client";

type Props = {
  movie: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">;
};

export function MovieCard({ movie }: Props) {
  return (
    <Link href={`/movie/${movie.slug}`} className="group block bg-white border border-[#d9d9d9] overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[2/3] bg-neutral-200 poster-gradient overflow-hidden">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="220px" unoptimized />
        ) : null}
        <span className="absolute top-3 left-3 z-10 bg-[#e50914] text-white text-xs font-bold px-3 py-1 rounded-sm">{movie.quality}</span>
        <div className="absolute z-10 bottom-0 left-0 right-0 p-3 text-white">
          <h3 className="font-bold text-[15px] leading-tight line-clamp-2 text-center drop-shadow">{movie.titleRu}</h3>
          <p className="text-xs text-white/85 mt-1 text-center">({movie.year})</p>
          <div className="flex items-center justify-between mt-3 text-sm font-bold">
            <span><b className="rating-kp">КП</b> {movie.kpRating?.toFixed(1) ?? "—"}</span>
            <span><b className="rating-imdb">IMDb</b> {movie.imdbRating?.toFixed(1) ?? "—"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
