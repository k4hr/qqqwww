<<<<<<< HEAD
import { redirect } from "next/navigation";
=======
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VibixPlayer } from "@/components/vibix-player";
import { TgFavoriteButton } from "@/components/tg/tg-favorite-button";
import { TgMovieCard } from "@/components/tg/tg-movie-card";
import { TgWatchTracker } from "@/components/tg/tg-watch-tracker";
import { getContentTypeLabel } from "@/lib/content";
import { findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";
import { siteUrl, watchPath } from "@/lib/seo-links";
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

<<<<<<< HEAD
export default async function TgWatchRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/watch/${slug}`);
=======
export default async function TgWatchPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  const similar = await findSimilarSeoMovies(movie, 8);
  const rating = movie.kpRating ?? movie.imdbRating;

  return (
    <div>
      <TgWatchTracker movieId={movie.id} />
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-5 pt-28">
        {movie.backdropUrl ? <Image src={movie.backdropUrl} alt="" fill sizes="420px" className="object-cover opacity-35" unoptimized priority /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/88 to-[#050507]/35" />
        <div className="relative grid grid-cols-[112px_minmax(0,1fr)] gap-4">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#15151d]">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill sizes="112px" className="object-cover" unoptimized priority /> : null}
          </div>
          <div className="min-w-0 self-end">
            <span className="rounded-full bg-[#e50914] px-2 py-1 text-[10px] font-black text-white">{movie.quality || "HD"}</span>
            <h1 className="mt-2 text-2xl font-black leading-tight">{movie.titleRu}</h1>
            <p className="mt-2 text-xs text-[#a1a1aa]">{getContentTypeLabel(movie.type)} · {movie.year}{rating ? ` · ${rating.toFixed(1)}` : ""}</p>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <TgFavoriteButton movieId={movie.id} />
        <Link href={siteUrl(watchPath(movie))} className="min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white">Открыть в браузере</Link>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-black">
        <VibixPlayer
          title={movie.titleRu}
          kinopoiskId={movie.kinopoiskId}
          imdbId={movie.imdbId}
          embedCode={movie.vibixEmbedCode}
          iframeUrl={movie.vibixIframeUrl}
          posterUrl={movie.posterUrl}
        />
      </section>
      <Link href={siteUrl(watchPath(movie))} className="mt-3 block rounded-2xl border border-white/10 bg-white/[.04] p-3 text-center text-sm font-bold text-[#d7d7dd]">Открыть плеер в браузере</Link>

      <p className="mt-5 line-clamp-5 text-sm leading-relaxed text-[#b7b7c0]">{movie.description || "Описание скоро появится."}</p>
      {movie.genres.length ? <div className="mt-4 flex flex-wrap gap-2">{movie.genres.slice(0, 5).map((item) => <span key={item.genreId} className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#d7d7dd]">{item.genre.name}</span>)}</div> : null}

      {similar.length ? <section className="mt-7"><h2 className="mb-3 text-xl font-black">Похожие фильмы</h2><div className="space-y-3">{similar.map((item) => <TgMovieCard key={item.id} movie={item} />)}</div></section> : null}
    </div>
  );
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
}
