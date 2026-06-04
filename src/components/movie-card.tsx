import Link from "next/link";
import Image from "next/image";
import type { Movie } from "@prisma/client";
import { Star } from "lucide-react";

type Props = {
  movie: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">;
};

export function MovieCard({ movie }: Props) {
  return (
    <Link href={`/movie/${movie.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_16px_40px_rgba(0,0,0,.25)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#c9a86a]/35 group-hover:shadow-[0_26px_60px_rgba(0,0,0,.45)]">
        <div className="relative aspect-[2/3] bg-neutral-900 poster-gradient overflow-hidden card-shine">
          {movie.posterUrl ? (
            <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="220px" />
          ) : null}

          <div className="absolute inset-x-0 top-0 z-10 p-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-[#5ed18c]/30 bg-[#5ed18c]/15 px-3 py-1 text-[11px] font-bold text-[#baf1ce] backdrop-blur">{movie.quality}</span>
            <span className="rounded-full border border-[#c9a86a]/25 bg-[#c9a86a]/12 px-2.5 py-1 text-[11px] font-bold text-[#f6dfaa] flex items-center gap-1"><Star size={12} fill="currentColor" /> {movie.kpRating?.toFixed(1) ?? movie.imdbRating?.toFixed(1) ?? "—"}</span>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white">
            <h3 className="font-bold text-[16px] leading-tight line-clamp-2">{movie.titleRu}</h3>
            <p className="text-xs text-white/70 mt-1">{movie.year}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-orange-300 font-bold">КП</span>
                <span className="ml-1.5 text-white/90">{movie.kpRating?.toFixed(1) ?? "—"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right">
                <span className="text-yellow-300 font-bold">IMDb</span>
                <span className="ml-1.5 text-white/90">{movie.imdbRating?.toFixed(1) ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
