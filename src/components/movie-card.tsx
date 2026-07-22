import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import type { Movie } from "@prisma/client";
import { similarPath, watchPath } from "@/lib/seo-links";
import { MovieCardActionsClient } from "@/components/movie-card-actions-client";

type Props = {
  movie: Pick<Movie, "id" | "slug" | "titleRu" | "year" | "type" | "posterUrl" | "quality" | "kpRating" | "imdbRating">;
};

function qualityLabel(quality: string) {
  if (/4k|2160/i.test(quality)) return "4K";
  if (/full\s*hd|1080/i.test(quality)) return "FullHD";
  if (/\bhd\b|720/i.test(quality)) return "HD";
  return quality.trim();
}

export function MovieCard({ movie }: Props) {
  const href = watchPath(movie);
  const similarHref = similarPath(movie);
  return (
    <article className="mf-card group relative block">
      <Link href={href} data-analytics-event="card_click" data-analytics-movie-id={movie.id} aria-label={`Смотреть: ${movie.titleRu}`} className="block">
        <div className="poster-fallback relative aspect-[2/3] overflow-hidden">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.titleRu}
              fill
              loading="lazy"
              fetchPriority="low"
              className="object-cover transition duration-500 group-hover:scale-[1.055] group-hover:brightness-[.52]"
              sizes="(max-width: 639px) calc(50vw - 22px), (max-width: 899px) 30vw, (max-width: 1099px) 23vw, 210px"
              quality={66}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#52525b]">
              <Film size={42} strokeWidth={1.4} />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">REDFILM</span>
            </div>
          )}

          {movie.quality.trim() ? <span className="mf-badge absolute left-2 top-2 z-20 max-w-[calc(100%_-_90px)] truncate sm:left-3 sm:top-3">{qualityLabel(movie.quality)}</span> : null}
          <span className="absolute right-2 top-2 z-20 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#d4d4d8] backdrop-blur sm:right-3 sm:top-3">{movie.type === "SERIES" ? "Сериал" : movie.type === "CARTOON" ? "Мультфильм" : movie.type === "ANIME" ? "Аниме" : "Фильм"}</span>
          <div className="absolute bottom-2 right-2 z-20 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur sm:bottom-3 sm:right-3 sm:text-[11px]">{movie.year}</div>
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(229,9,20,.20),rgba(0,0,0,.50))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        <div className="relative p-2.5 sm:p-3.5">
          <h3 className="line-clamp-2 min-h-[40px] text-[clamp(14px,2vw,16px)] font-black leading-5 text-white transition-colors group-hover:text-[#ff4d55]">{movie.titleRu}</h3>
          {movie.kpRating != null || movie.imdbRating != null ? <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">{movie.kpRating != null ? <span className="card-rating"><b className="rating-kp">КП</b> {movie.kpRating.toFixed(1)}</span> : null}{movie.imdbRating != null ? <span className="card-rating"><b className="rating-imdb">IMDb</b> {movie.imdbRating.toFixed(1)}</span> : null}</div> : null}
        </div>
      </Link>
      <div className="px-2.5 pb-3 opacity-100 transition sm:px-3.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <MovieCardActionsClient movie={{ id: movie.id, slug: movie.slug, title: movie.titleRu, year: movie.year, posterUrl: movie.posterUrl, type: movie.type, kpRating: movie.kpRating, imdbRating: movie.imdbRating }} href={href} similarHref={similarHref} />
      </div>
    </article>
  );
}
