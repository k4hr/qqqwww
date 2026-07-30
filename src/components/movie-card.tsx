import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@prisma/client";
import { ArtworkPlaceholder, isGenericRedfilmArtwork } from "@/components/artwork-placeholder";
import { similarPath, watchPath } from "@/lib/seo-links";
import { MovieCardActionsClient } from "@/components/movie-card-actions-client";

type MovieCardMovie = Pick<Movie, "id" | "slug" | "titleRu" | "year" | "type" | "posterUrl" | "quality" | "kpRating" | "imdbRating"> & { editorialPosterUrl?: string | null };

type Props = { movie: MovieCardMovie };

function qualityLabel(quality: string) {
  if (/4k|2160/i.test(quality)) return "4K";
  if (/full\s*hd|1080/i.test(quality)) return "FullHD";
  if (/\bhd\b|720/i.test(quality)) return "HD";
  return quality.trim();
}

export function MovieCard({ movie }: Props) {
  const href = watchPath(movie);
  const similarHref = similarPath(movie);
  const typeLabel = movie.type === "SERIES" ? "Сериал"
    : movie.type === "CARTOON" ? "Мультфильм"
      : movie.type === "ANIME" ? "Аниме"
        : "Фильм";
  const rating = movie.kpRating ?? movie.imdbRating;
  const effectivePosterUrl = movie.editorialPosterUrl ?? movie.posterUrl;
  const hasPoster = !isGenericRedfilmArtwork(effectivePosterUrl);

  return (
    <article className="mf-card group relative block min-w-0">
      <div className="rf-poster-shell relative aspect-[2/3]">
        <Link href={href} data-analytics-event="card_click" data-analytics-movie-id={movie.id} aria-label={`Смотреть: ${movie.titleRu}`} className="absolute inset-0 block">
          {hasPoster ? (
            <Image
              src={effectivePosterUrl!}
              alt={movie.titleRu}
              fill
              loading="lazy"
              fetchPriority="low"
              className="object-cover transition duration-500 ease-out group-hover:scale-[1.025] group-hover:brightness-[.82]"
              sizes="(max-width: 639px) calc(50vw - 22px), (max-width: 899px) 30vw, (max-width: 1099px) 23vw, 210px"
              quality={72}
            />
          ) : (
            <ArtworkPlaceholder title={movie.titleRu} />
          )}

          {movie.quality.trim() ? <span className="rf-card-quality absolute left-2.5 top-2.5 z-20 max-w-[58%] truncate">{qualityLabel(movie.quality)}</span> : null}
          {rating != null ? (
            <span className="rf-card-rating absolute right-2.5 top-2.5 z-20">
              {rating.toFixed(1)}
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/48 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Link>
        <div className="rf-card-actions absolute inset-x-2 bottom-2 z-20 translate-y-2 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <MovieCardActionsClient movie={{ id: movie.id, slug: movie.slug, title: movie.titleRu, year: movie.year, posterUrl: effectivePosterUrl, type: movie.type, kpRating: movie.kpRating, imdbRating: movie.imdbRating }} href={href} similarHref={similarHref} />
        </div>
      </div>

      <Link href={href} data-analytics-event="card_click" data-analytics-movie-id={movie.id} className="block pt-2.5">
        <div>
          <h3 className="rf-card-title line-clamp-2 transition-colors group-hover:text-white">{movie.titleRu}</h3>
          <div className="rf-card-meta mt-1.5">{movie.year} · {typeLabel}</div>
        </div>
      </Link>
    </article>
  );
}
