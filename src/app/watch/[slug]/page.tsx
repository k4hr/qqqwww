import type { Metadata } from "next";
import type { Movie } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArtworkPlaceholder, isGenericRedfilmArtwork } from "@/components/artwork-placeholder";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { PlayerBlock } from "@/components/player-block";
import { VibixBanner, VibixFlyrollSlot } from "@/components/vibix-banner";
import { AnalyticsEvent } from "@/components/analytics-event";
import { WatchClientActions } from "@/components/watch-client-actions";
import { ExpandableDescription } from "@/components/expandable-description";
import { TelegramWatchPromo } from "@/components/telegram-watch-promo";
import { WatchInstallCard } from "@/components/pwa/watch-install-card";
import { PartnerTrack } from "@/components/partner-track";
import { extractCountries } from "@/lib/catalog-filters";
import { getWatchArtwork } from "@/lib/movie-artwork";
import { takeUniqueMovies } from "@/lib/recommendation-dedupe";
import { getSeoMovieBySlug, getMovieSlugRedirect, getSimilarMovieGroups } from "@/lib/seo-pages";
import { countryPath, genrePath, similarPath, watchPath, yearPath } from "@/lib/seo-links";
import { breadcrumbJsonLd, itemListJsonLd, movieJsonLd, videoObjectJsonLd } from "@/lib/seo/schema";
import { watchSeoDescription, watchSeoTitle } from "@/lib/seo/meta";
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

function runtimeLabel(duration?: number | null) {
  if (!duration) return null;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (!hours) return `${minutes} мин`;
  return `${hours} ч${minutes ? ` ${minutes} мин` : ""}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const requestedSlug = (await params).slug;
  const movie = await getSeoMovieBySlug(requestedSlug) ?? (await getMovieSlugRedirect(requestedSlug))?.movie;
  if (!movie) return {};
  const artwork = await getWatchArtwork(movie.id, movie.backdropUrl);
  const effectiveMovie = {
    ...movie,
    titleRu: movie.titleRu,
    posterUrl: artwork.posterUrl,
    backdropUrl: artwork.backdropUrl,
  };
  const title = watchSeoTitle(effectiveMovie);
  const description = watchSeoDescription(effectiveMovie);
  const canonical = watchPath(movie);
  const image = artwork.backdropUrl;

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
  const requestedSlug = (await params).slug;
  const movie = await getSeoMovieBySlug(requestedSlug);
  if (!movie) {
    const redirectEntry = await getMovieSlugRedirect(requestedSlug);
    if (redirectEntry?.movie) permanentRedirect(`/watch/${redirectEntry.movie.slug}`);
    notFound();
  }
  const countries = extractCountries(movie.country);
  const [similarGroups, watchArtwork] = await Promise.all([
    getSimilarMovieGroups(movie, 6, 4),
    getWatchArtwork(movie.id, movie.backdropUrl),
  ]);
  const displayTitle = movie.titleRu;
  const posterUrl = watchArtwork.posterUrl;
  const effectiveMovie = { ...movie, titleRu: displayTitle, posterUrl, backdropUrl: watchArtwork.backdropUrl };
  const similar = takeUniqueMovies(similarGroups.primary, 6, new Set([movie.id])).map(toMovieCardData);
  const atmosphere = takeUniqueMovies(similarGroups.atmosphere, 4, new Set([movie.id, ...similar.map((item) => item.id)])).map(toMovieCardData);
  const description = movie.description.trim() || "Описание скоро появится";
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;
  const contentTypePath = getContentTypePath(movie.type);
  const contentTypePlural = getContentTypePluralLabel(movie.type);
  const similarTitle = movie.type === "ANIME" ? "Похожие аниме" : movie.type === "CARTOON" ? "Похожие мультфильмы" : movie.type === "SERIES" ? "Похожие сериалы" : "Похожие фильмы";

  const backdropUrl = watchArtwork.backdropUrl;
  const hasBackdrop = watchArtwork.backdropSource !== "REDFILM_FALLBACK" && !isGenericRedfilmArtwork(backdropUrl);
  const hasPoster = !isGenericRedfilmArtwork(posterUrl);


  return (
    <div className="pb-5 sm:pb-7">
      <AnalyticsEvent type="page_view" movieId={movie.id} />
      <PartnerTrack type="MOVIE_OPEN" movieId={movie.id} />
      <JsonLd data={[
        movieJsonLd({ ...effectiveMovie, backdropUrl }),
        videoObjectJsonLd({ ...effectiveMovie, backdropUrl }),
        breadcrumbJsonLd([
          { name: "REDFILM", url: "/" },
          { name: contentTypePlural, url: contentTypePath },
          { name: displayTitle, url: watchPath(movie) },
        ]),
        itemListJsonLd(`${similarTitle} к ${displayTitle}`, similarPath(movie), similar),
      ]} />

      <article className="watch-cinematic-hero rf-watch-hero relative min-h-[420px] overflow-hidden border-b border-white/[.055] sm:min-h-[470px]">
        {hasBackdrop ? (
          <div className="rf-watch-backdrop-stage absolute inset-0" aria-hidden>
            <Image
              src={backdropUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              quality={64}
              unoptimized={backdropUrl.startsWith("data:")}
              className="rf-watch-backdrop-ambient"
            />
            <div className="rf-watch-backdrop-main-shell">
              <Image
                src={backdropUrl}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 100vw, 78vw"
                quality={82}
                unoptimized={backdropUrl.startsWith("data:")}
                className="rf-watch-backdrop-main"
              />
            </div>
          </div>
        ) : <ArtworkPlaceholder title={displayTitle} compact />}
        <div className="rf-watch-scrim-primary absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,8,.94)_0%,rgba(7,7,8,.67)_46%,rgba(7,7,8,.12)_100%)] max-sm:bg-[linear-gradient(0deg,rgba(7,7,8,.98)_5%,rgba(7,7,8,.64)_68%,rgba(7,7,8,.12)_100%)]" />
        <div className="rf-watch-scrim-bottom absolute inset-0 bg-[linear-gradient(0deg,#070708_0%,transparent_31%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,43,66,.42),transparent)]" />
        <div className="container relative z-10 flex min-h-[420px] flex-col justify-end pb-7 pt-20 sm:min-h-[470px] sm:pb-9">
          <nav className="rf-watch-breadcrumb mb-5 min-w-0 text-xs text-[#74757d]" aria-label="Хлебные крошки">
            <Link href="/" className="rf-watch-breadcrumb-root hover:text-white">REDFILM</Link>
            <span className="rf-watch-breadcrumb-part">
              <span className="rf-watch-breadcrumb-separator" aria-hidden="true">/</span>
              <Link href={contentTypePath} className="hover:text-white">{contentTypePlural}</Link>
            </span>
            <span className="rf-watch-breadcrumb-part rf-watch-breadcrumb-tail">
              <span className="rf-watch-breadcrumb-separator" aria-hidden="true">/</span>
              <span className="rf-watch-breadcrumb-current text-[#a0a1a8]">{displayTitle}</span>
            </span>
          </nav>
          <div className="rf-watch-layout grid items-end gap-5">
            <div className="rf-watch-poster relative aspect-[2/3] overflow-hidden rounded-[11px] bg-[#111216] shadow-[0_18px_46px_rgba(0,0,0,.4)]">
              {hasPoster ? <Image src={posterUrl!} alt={displayTitle} fill unoptimized={posterUrl?.startsWith("data:")} className="object-cover" sizes="(max-width: 380px) 102px, (max-width: 640px) 112px, (max-width: 1099px) 180px, 200px" quality={76} /> : <ArtworkPlaceholder title={displayTitle} />}
            </div>
            <div className="rf-watch-copy min-w-0 pb-1">
              <div className="rf-watch-heading min-w-0">
                {movie.quality ? <span className="mf-badge">{movie.quality}</span> : null}
                <h1 className="mt-3 max-w-4xl break-words text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.02] tracking-[-.045em] text-white">{displayTitle}</h1>
                {movie.titleOriginal ? <p className="mt-2 break-words text-sm font-medium text-[#8f9098]">{movie.titleOriginal}</p> : null}
                <div className="rf-watch-meta mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm font-medium text-[#b5b6bd]">
                  <Link href={yearPath(movie)} className="rf-watch-meta-item hover:text-white">{movie.year}</Link>
                  {runtimeLabel(movie.duration) ? <><span className="rf-watch-meta-separator text-white/25">•</span><span className="rf-watch-meta-item">{runtimeLabel(movie.duration)}</span></> : null}
                  {countries[0] ? <><span className="rf-watch-meta-separator text-white/25">•</span><Link href={countryPath(countries[0])} className="rf-watch-meta-item hover:text-white">{countries[0]}</Link></> : null}
                  {movie.genres.slice(0, 2).map(({ genre }) => <span key={genre.id} className="contents"><span className="rf-watch-meta-separator text-white/25">•</span><Link href={genrePath(genre)} className="rf-watch-meta-item hover:text-white">{genre.name}</Link></span>)}
                  {movie.kpRating != null ? <><span className="rf-watch-meta-separator text-white/25">•</span><span className="rf-watch-meta-item"><b className="font-semibold text-[#d5b36a]">КП</b>&nbsp;{movie.kpRating.toFixed(1)}</span></> : null}
                  {movie.imdbRating != null ? <><span className="rf-watch-meta-separator text-white/25">•</span><span className="rf-watch-meta-item"><b className="font-semibold text-[#d5b36a]">IMDb</b>&nbsp;{movie.imdbRating.toFixed(1)}</span></> : null}
                </div>
              </div>
              <div className="rf-watch-body min-w-0">
                <ExpandableDescription text={description} className="mt-4" />
                <WatchClientActions movie={{ id: movie.id, slug: movie.slug, title: displayTitle, year: movie.year, posterUrl, type: movie.type, kpRating: movie.kpRating, imdbRating: movie.imdbRating }} />
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="container">
        <VibixBanner slot="movie_above_player" size="728x90" />
        <VibixFlyrollSlot slot="movie_above_player" />
        <PlayerBlock movie={effectiveMovie} />
        <TelegramWatchPromo />

        <section className="rf-section">
        <div className="rf-section-header"><h2 className="rf-section-title">{similarTitle}</h2><Link href={similarPath(movie)} className="rf-section-link">Смотреть все →</Link></div>
        {similar.length ? <div className="movie-grid home-movie-strip">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div> : <div className="border-t border-white/[.07] py-5 text-sm text-[#74757d]">Похожие фильмы скоро появятся.</div>}
        </section>
        {atmosphere.length ? (
          <section className="rf-section">
            <div className="mb-5"><h2 className="rf-section-title">Похожее по атмосфере</h2><p className="mt-2 text-sm text-[#74757d]">Истории с похожим настроением в другом формате.</p></div>
            <div className="movie-grid home-movie-strip">{atmosphere.map((item) => <MovieCard key={item.id} movie={item} />)}</div>
          </section>
        ) : null}
        <WatchInstallCard />
      </div>
    </div>
  );
}
