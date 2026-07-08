import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Film, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { TvFocusProvider } from "@/components/tv/tv-focus-provider";
import { TvCss, TvShell, TvTopBar } from "@/components/tv/tv-ui";
import { getTvMovieBySlug, tvPlayerPath, tvPoster, tvTypeLabel, TV_REVALIDATE_SECONDS } from "@/lib/tv";

export const revalidate = TV_REVALIDATE_SECONDS;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getTvMovieBySlug((await params).slug);
  if (!movie) return {};
  return {
    title: `${movie.titleRu} (${movie.year}) — REDFILM TV`,
    description: `Смотреть ${movie.titleRu} (${movie.year}) в REDFILM TV на телевизоре и Media Station X.`,
    robots: { index: false, follow: true },
  };
}

export default async function MsxWatchPage({ params }: Props) {
  const movie = await getTvMovieBySlug((await params).slug);
  if (!movie) notFound();
  const poster = tvPoster(movie);
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;

  return (
    <TvShell>
      <TvCss />
      <TvFocusProvider />
      <TvTopBar />
      <section className="relative min-h-[calc(100vh-96px)] overflow-hidden px-10 py-12">
        {movie.backdropUrl ? <Image src={movie.backdropUrl} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-[.28]" unoptimized priority /> : null}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#050507_0%,rgba(5,5,7,.94)_42%,rgba(5,5,7,.52)_100%)]" />
        <Link data-tv-focus data-tv-autofocus href="/msx" className="tv-pill mb-8 inline-flex"><ArrowLeft size={22} /> Назад</Link>
        <div className="grid max-w-[1500px] grid-cols-[340px_minmax(0,1fr)] gap-10 max-lg:grid-cols-1">
          <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-[34px] border border-white/10 shadow-[0_30px_120px_rgba(0,0,0,.55)] max-lg:w-[300px]">
            {poster ? <Image src={poster} alt={movie.titleRu} fill sizes="360px" className="object-cover" unoptimized priority /> : <div className="absolute inset-0 flex items-center justify-center text-white/30"><Film size={76} /></div>}
          </div>
          <div className="min-w-0 py-2">
            <div className="flex flex-wrap gap-3 text-xl font-black uppercase tracking-[.13em] text-[#ff4d55]"><span>{tvTypeLabel(movie.type)}</span><span>•</span><span>{movie.year}</span>{movie.quality ? <><span>•</span><span>{movie.quality}</span></> : null}</div>
            <h1 className="mt-5 break-words text-[clamp(3rem,7vw,7rem)] font-black leading-[.9] tracking-[-.06em]">{movie.titleRu}</h1>
            {movie.titleOriginal ? <p className="mt-3 text-2xl font-bold text-white/[.45]">{movie.titleOriginal}</p> : null}
            <div className="mt-7 flex flex-wrap items-center gap-4 text-2xl text-white/[.78]">
              {rating ? <span className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-black">★ {rating.toFixed(1)}</span> : null}
              {movie.duration ? <span>{movie.duration} мин.</span> : null}
              {movie.country ? <span>{movie.country}</span> : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {movie.genres.slice(0, 8).map((item) => <span key={item.genreId} className="rounded-2xl border border-white/10 bg-white/[.07] px-4 py-2 text-xl font-bold text-white/[.78]">{item.genre.name}</span>)}
            </div>
            <p className="mt-8 max-w-5xl text-2xl leading-relaxed text-white/70">{movie.description || "Описание скоро появится."}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link data-tv-focus href={tvPlayerPath(movie)} className="tv-cta"><Play fill="currentColor" /> Смотреть</Link>
              <Link data-tv-focus href={`/watch/${movie.slug}`} className="tv-cta tv-cta-secondary">Открыть обычную страницу</Link>
            </div>
          </div>
        </div>
      </section>
    </TvShell>
  );
}
