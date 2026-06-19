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
            className="object-cover transition duration-500 group-hover:scale-[1.055] group-hover:brightness-[.58]"
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
        <div className="absolute bottom-3 right-3 z-10 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur">
          {movie.year}
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(229,9,20,.22),rgba(0,0,0,.48))] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-[#e50914] px-4 py-2 text-xs font-black text-white shadow-[0_0_30px_rgba(229,9,20,.35)]">
            <Play size={14} fill="currentColor" /> Смотреть
          </span>
        </div>
      </div>

      <div className="p-3.5">
        <h3 className="line-clamp-2 min-h-[40px] text-[15px] font-black leading-5 text-white transition-colors group-hover:text-[#ff4d55]">{movie.titleRu}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <span className="rounded-full border border-white/[.07] bg-black/25 px-2 py-1 text-center"><b className="rating-kp">КП</b> {movie.kpRating?.toFixed(1) ?? "—"}</span>
          <span className="rounded-full border border-white/[.07] bg-black/25 px-2 py-1 text-center"><b className="rating-imdb">IMDb</b> {movie.imdbRating?.toFixed(1) ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}
