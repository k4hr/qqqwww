import Link from "next/link";
import Image from "next/image";
import { Film, Play } from "lucide-react";
import type { Movie } from "@prisma/client";

type Props = {
  movie: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">;
};

export function MovieCard({ movie }: Props) {
  return (
    <Link href={`/movie/${movie.slug}`} className="mf-card group block">
      <div className="poster-fallback relative aspect-[2/3] overflow-hidden">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={movie.titleRu}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04] group-hover:brightness-50"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 210px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#52525b]">
            <Film size={42} strokeWidth={1.4} />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">REDFILM</span>
          </div>
        )}

        <span className="mf-badge absolute left-3 top-3 z-10">{movie.quality || "HD"}</span>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-[#e50914] px-4 py-2 text-xs font-bold text-white shadow-lg">
            <Play size={14} fill="currentColor" /> Смотреть
          </span>
        </div>
      </div>

      <div className="p-3.5">
        <h3 className="line-clamp-2 min-h-[40px] text-[15px] font-bold leading-5 text-white">{movie.titleRu}</h3>
        <div className="mt-2 flex items-center justify-between text-xs text-[#8b8b95]">
          <span>{movie.year}</span>
          <span className="flex items-center gap-2.5">
            <span><b className="rating-kp">КП</b> {movie.kpRating?.toFixed(1) ?? "—"}</span>
            <span><b className="rating-imdb">IMDb</b> {movie.imdbRating?.toFixed(1) ?? "—"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
