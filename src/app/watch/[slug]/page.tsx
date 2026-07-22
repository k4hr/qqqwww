import type { Metadata } from "next";
import type { Movie } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { PlayerBlock } from "@/components/player-block";
import { VibixBanner, VibixFlyrollSlot } from "@/components/vibix-banner";
import { AnalyticsEvent } from "@/components/analytics-event";
import { WatchClientActions } from "@/components/watch-client-actions";
import { TelegramWatchPromo } from "@/components/telegram-watch-promo";
import { PartnerTrack } from "@/components/partner-track";
import { WatchMediaGallery } from "@/components/watch-media-gallery";
import { extractCountries } from "@/lib/catalog-filters";
import { getWatchArtwork } from "@/lib/movie-artwork";
import { takeUniqueMovies } from "@/lib/recommendation-dedupe";
import { getSeoMovieBySlug, getSimilarMovieGroups } from "@/lib/seo-pages";
import { countryPath, genrePath, similarPath, watchPath, yearPath } from "@/lib/seo-links";
import { breadcrumbJsonLd, itemListJsonLd, movieJsonLd, videoObjectJsonLd } from "@/lib/seo/schema";
import { watchSeoDescription, watchSeoH1, watchSeoTitle } from "@/lib/seo/meta";
import { getContentTypePath, getContentTypePluralLabel } from "@/lib/content";


export const revalidate = 600;

type MovieCardData = Pick<Movie, "id" | "slug" | "titleRu" | "year" | "type" | "posterUrl" | "backdropUrl" | "quality" | "kpRating" | "imdbRating">;

function toMovieCardData(movie: MovieCardData): MovieCardData {
  return {
    id: movie.id,
    slug: movie.slug,
    titleRu: movie.titleRu,
    year: movie.year,
    type: movie.type,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    quality: movie.quality,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
  };
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) return {};
  const title = watchSeoTitle(movie);
  const description = watchSeoDescription(movie);
  const canonical = watchPath(movie);
  const image = movie.backdropUrl || movie.posterUrl;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "video.movie",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function WatchPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  const countries = extractCountries(movie.country);
  const [similarGroups, watchArtwork] = await Promise.all([
    getSimilarMovieGroups(movie, 6, 4),
    getWatchArtwork(movie.id, movie.backdropUrl),
  ]);
  const similar = takeUniqueMovies(similarGroups.primary, 6, new Set([movie.id])).map(toMovieCardData);
  const atmosphere = takeUniqueMovies(similarGroups.atmosphere, 4, new Set([movie.id, ...similar.map((item) => item.id)])).map(toMovieCardData);
  const description = movie.description.trim() || "Описание скоро появится";
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;
  const contentTypePath = getContentTypePath(movie.type);
  const contentTypePlural = getContentTypePluralLabel(movie.type);
  const similarTitle = movie.type === "ANIME" ? "Похожие аниме" : movie.type === "CARTOON" ? "Похожие мультфильмы" : movie.type === "SERIES" ? "Похожие сериалы" : "Похожие фильмы";

  const backdropUrl = watchArtwork.backdropUrl;
  const mediaArtworks = watchArtwork.artworks.map((item) => ({
    id: item.id,
    type: item.type,
    url: item.url,
    width: item.width,
    height: item.height,
    language: item.language,
  }));

  return (
    <div className="pb-5 sm:pb-7">
      <AnalyticsEvent type="page_view" movieId={movie.id} />
      <PartnerTrack type="MOVIE_OPEN" movieId={movie.id} />
      <JsonLd data={[
        movieJsonLd(movie),
        videoObjectJsonLd(movie),
        breadcrumbJsonLd([
          { name: "REDFILM", url: "/" },
          { name: contentTypePlural, url: contentTypePath },
          { name: movie.titleRu, url: watchPath(movie) },
        ]),
        itemListJsonLd(`${similarTitle} к ${movie.titleRu}`, similarPath(movie), similar),
      ]} />

      <article className="watch-cinematic-hero relative min-h-[52svh] overflow-hidden sm:min-h-[62svh] lg:min-h-[76svh]">
        <Image
          src={backdropUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(229,9,20,.24),transparent_36%),linear-gradient(90deg,rgba(5,5,8,.98)_0%,rgba(5,5,8,.82)_46%,rgba(5,5,8,.28)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,.84)_18%,transparent_58%)]" />
        <div className="container relative z-10 flex min-h-[52svh] flex-col justify-end pb-6 pt-20 sm:min-h-[62svh] sm:pb-9 lg:min-h-[76svh]">
          <nav className="mb-4 flex min-w-0 flex-wrap items-center gap-2 break-words text-sm text-[#b4b4bd]" aria-label="Хлебные крошки">
            <Link href="/" className="hover:text-white">REDFILM</Link><span>/</span>
            <Link href={contentTypePath} className="hover:text-white">{contentTypePlural}</Link><span>/</span>
            <span className="line-clamp-1 text-[#e4e4e7]">{movie.titleRu}</span>
          </nav>
          <div className="grid items-end gap-4 sm:grid-cols-[125px_minmax(0,1fr)] md:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
            <div className="poster-fallback relative aspect-[2/3] w-[112px] overflow-hidden rounded-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,.62)] sm:w-full">
              {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="(max-width: 640px) 120px, (max-width: 1024px) 170px, 220px" /> : <div className="absolute inset-0 flex items-center justify-center text-[#666670]"><Film size={42} /></div>}
            </div>
            <div className="min-w-0 pb-1">
              <span className="mf-badge">{movie.quality || "HD"}</span>
              <h1 className="mt-3 max-w-5xl break-words text-[clamp(2rem,9vw,5.4rem)] font-black leading-[.95] tracking-[-.06em] text-white drop-shadow-2xl">{watchSeoH1(movie)}</h1>
              {movie.titleOriginal ? <p className="mt-2 break-words text-sm font-bold text-[#a1a1aa] sm:text-base">{movie.titleOriginal}</p> : null}
              <p className="line-clamp-3 mt-4 max-w-3xl text-sm leading-relaxed text-[#d4d4da] sm:text-base lg:text-lg">{description}</p>
              <dl className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <Fact label="Год"><Link href={yearPath(movie)}>{movie.year}</Link></Fact>
                <Fact label="КП">{movie.kpRating?.toFixed(1) ?? "—"}</Fact>
                <Fact label="IMDb">{movie.imdbRating?.toFixed(1) ?? "—"}</Fact>
                <Fact label="Длительность">{movie.duration ? `${movie.duration} мин.` : "—"}</Fact>
                <Fact label="Страна">{countries[0] ? <Link href={countryPath(countries[0])}>{countries[0]}</Link> : "—"}</Fact>
                <Fact label="Жанр">{movie.genres[0] ? <Link href={genrePath(movie.genres[0].genre)}>{movie.genres[0].genre.name}</Link> : "—"}</Fact>
              </dl>
              <WatchClientActions movie={{ id: movie.id, slug: movie.slug, title: movie.titleRu, year: movie.year, posterUrl: movie.posterUrl, type: movie.type, kpRating: movie.kpRating, imdbRating: movie.imdbRating }} />
            </div>
          </div>
        </div>
      </article>

      <div className="container">
        <VibixBanner slot="movie_above_player" size="728x90" />
        <VibixFlyrollSlot slot="movie_above_player" />
        <PlayerBlock movie={movie} />
        <TelegramWatchPromo />
        <WatchMediaGallery title={movie.titleRu} trailerUrl={movie.trailerUrl} artworks={mediaArtworks} />

        <section className="mt-8">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-white">{similarTitle}</h2><Link href={similarPath(movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link></div>
        {similar.length ? <div className="movie-grid">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div> : <div className="mf-panel p-5 text-[#a1a1aa]">Похожие фильмы скоро появятся.</div>}
        </section>
        {atmosphere.length ? (
          <section className="mt-8">
            <div className="mb-5"><h2 className="text-2xl font-black text-white">Похожее по атмосфере</h2><p className="mt-1 text-sm text-[#a1a1aa]">Отдельная подборка с сильной тематической связью, но другим форматом.</p></div>
            <div className="movie-grid">{atmosphere.map((item) => <MovieCard key={item.id} movie={item} />)}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-2.5"><dt className="text-[10px] uppercase tracking-wider text-[#71717a]">{label}</dt><dd className="mt-1 truncate text-white">{children}</dd></div>;
}
