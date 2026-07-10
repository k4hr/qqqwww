import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { SectionGrid } from "@/components/section-grid";
import { PlayerBlock } from "@/components/player-block";
import { VibixBanner, VibixFlyrollSlot } from "@/components/vibix-banner";
import { AnalyticsEvent } from "@/components/analytics-event";
import { WatchClientActions } from "@/components/watch-client-actions";
import { TelegramWatchPromo } from "@/components/telegram-watch-promo";
import { PartnerTrack } from "@/components/partner-track";
import { buildDefaultCatalogCountryWhere, extractCountries } from "@/lib/catalog-filters";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { getPopularMovies, getRecentPopularityStats } from "@/lib/popularity";
import { takeUniqueMovies } from "@/lib/recommendation-dedupe";
import { findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";
import { buildAudienceCandidateWhere, sortAudienceMovies } from "@/lib/similar";
import { countryPath, genrePath, similarPath, watchPath, yearPath } from "@/lib/seo-links";
import { breadcrumbJsonLd, itemListJsonLd, movieJsonLd, videoObjectJsonLd } from "@/lib/seo/schema";
import { watchSeoDescription, watchSeoH1, watchSeoTitle } from "@/lib/seo/meta";
import { getContentTypeLabel, getContentTypePath, getContentTypePluralLabel } from "@/lib/content";


export const revalidate = 600;

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
  const primaryGenre = movie.genres[0]?.genre;
  const recommendationWhere = [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { id: { not: movie.id } }];
  const [similarCandidates, audienceCandidates, genreCandidates, yearCandidates, countryCandidates, popularityStats] = await Promise.all([
    findSimilarSeoMovies(movie, 12),
    prisma.movie.findMany({ where: { AND: [...recommendationWhere, buildAudienceCandidateWhere(movie)] }, include: { genres: { include: { genre: true } }, cast: { include: { person: true }, orderBy: { sortOrder: "asc" } } }, orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }], take: 180 }),
    primaryGenre ? prisma.movie.findMany({ where: { AND: [...recommendationWhere, { genres: { some: { genreId: movie.genres[0].genreId } } }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 80 }) : Promise.resolve([]),
    prisma.movie.findMany({ where: { AND: [...recommendationWhere, { year: movie.year }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 60 }),
    countries[0] ? prisma.movie.findMany({ where: { AND: [...recommendationWhere, { country: { contains: countries[0], mode: "insensitive" } }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 60 }) : Promise.resolve([]),
    getRecentPopularityStats(7),
  ]);
  const excluded = new Set([movie.id]);
  const selectBlock = <T extends { id: string }>(items: T[], count = 6, minCount = 4) => {
    const selected = takeUniqueMovies(items, count, excluded);
    if (selected.length < minCount) return [];
    selected.forEach((item) => excluded.add(item.id));
    return selected;
  };
  const similar = selectBlock(similarCandidates, 6, 1);
  const watchedTogether = selectBlock(sortAudienceMovies(movie, audienceCandidates, 20).length ? sortAudienceMovies(movie, audienceCandidates, 20) : getPopularMovies(genreCandidates, popularityStats, 20));
  const moreInGenre = selectBlock(genreCandidates);
  const sameYear = selectBlock(yearCandidates);
  const sameCountry = sameYear.length ? [] : selectBlock(countryCandidates);
  const description = movie.description.trim() || "Описание скоро появится";
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;
  const contentTypePath = getContentTypePath(movie.type);
  const contentTypePlural = getContentTypePluralLabel(movie.type);
  const contentTypeSingleLower = getContentTypeLabel(movie.type).toLocaleLowerCase("ru-RU");
  const similarTitle = movie.type === "ANIME" ? "Похожие аниме" : movie.type === "CARTOON" ? "Похожие мультфильмы" : movie.type === "SERIES" ? "Похожие сериалы" : "Похожие фильмы";

  return (
    <div className="container py-5 sm:py-7">
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

      <nav className="mb-5 flex min-w-0 flex-wrap items-center gap-2 break-words text-sm text-[#7d7d87]" aria-label="Хлебные крошки">
        <Link href="/" className="hover:text-white">REDFILM</Link><span>/</span>
        <Link href={contentTypePath} className="hover:text-white">{contentTypePlural}</Link><span>/</span>
        <span className="text-[#b5b5bd]">{movie.titleRu}</span>
      </nav>

      <article className="glass-panel section-glow relative overflow-hidden rounded-[26px] p-4 sm:p-6 lg:p-8">
        {movie.backdropUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${movie.backdropUrl})` }} /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,9,.98),rgba(6,6,9,.82),rgba(65,0,6,.36))]" />
        <div className="relative grid items-center gap-5 sm:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
          <div className="poster-fallback relative mx-auto aspect-[2/3] w-full max-w-[150px] overflow-hidden rounded-2xl border border-white/10 lg:max-w-[190px]">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="(max-width: 640px) 150px, 190px" unoptimized priority /> : <div className="absolute inset-0 flex items-center justify-center text-[#666670]"><Film size={42} /></div>}
          </div>
          <div className="min-w-0">
            <span className="mf-badge">{movie.quality || "HD"}</span>
            <h1 className="mt-3 break-words text-[clamp(1.55rem,6vw,3rem)] font-black tracking-[-.03em] text-white">{watchSeoH1(movie)}</h1>
            <p className="line-clamp-3 mt-3 max-w-3xl text-sm leading-relaxed text-[#b9b9c0] sm:text-base">{description}</p>
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
      </article>

      <VibixBanner slot="movie_above_player" size="728x90" />
      <VibixFlyrollSlot slot="movie_above_player" />
      <PlayerBlock movie={movie} />
      <TelegramWatchPromo />
      <VibixBanner slot="movie_below_player" size="680x250" />
      <VibixFlyrollSlot slot="movie_below_player" />

      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-white">{similarTitle}</h2><Link href={similarPath(movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link></div>
        {similar.length ? <div className="movie-grid">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div> : <div className="mf-panel p-5 text-[#a1a1aa]">Похожие фильмы скоро появятся.</div>}
      </section>
      {watchedTogether.length ? <SectionGrid title={`С этим ${contentTypeSingleLower} смотрят`} href={primaryGenre ? genrePath(primaryGenre) : "/top"} movies={watchedTogether} showSorts={false} mobileCarousel /> : null}
      {moreInGenre.length && primaryGenre ? <SectionGrid title={`Ещё в жанре ${primaryGenre.name}`} href={genrePath(primaryGenre)} movies={moreInGenre} showSorts={false} mobileCarousel /> : null}
      {sameYear.length ? <SectionGrid title={`${contentTypePlural} ${movie.year} года`} href={yearPath(movie)} movies={sameYear} showSorts={false} mobileCarousel /> : null}
      {sameCountry.length && countries[0] ? <SectionGrid title={`${contentTypePlural} ${countries[0]}`} href={countryPath(countries[0])} movies={sameCountry} showSorts={false} mobileCarousel /> : null}
      <VibixBanner slot="movie_bottom" size="680x200" />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-2.5"><dt className="text-[10px] uppercase tracking-wider text-[#71717a]">{label}</dt><dd className="mt-1 truncate text-white">{children}</dd></div>;
}
