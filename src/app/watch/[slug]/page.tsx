import type { Metadata } from "next";
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
import { buildDefaultCatalogCountryWhere, extractCountries } from "@/lib/catalog-filters";
import { getSeoMovieBySlug, type SeoMovie } from "@/lib/seo-pages";
import { countryPath, genrePath, similarPath, watchPath, yearPath } from "@/lib/seo-links";
import { breadcrumbJsonLd, itemListJsonLd, movieJsonLd, videoObjectJsonLd } from "@/lib/seo/schema";
import { watchSeoDescription, watchSeoH1, watchSeoTitle } from "@/lib/seo/meta";
import { getContentTypeLabel, getContentTypePath, getContentTypePluralLabel } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

type SimilarCardMovie = React.ComponentProps<typeof MovieCard>["movie"];

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

async function getWatchSimilarMovies(movie: SeoMovie, limit = 12): Promise<SimilarCardMovie[]> {
  const cached = await prisma.movieSimilarity.findMany({
    where: { sourceMovieId: movie.id },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const cachedIds = cached.map((item) => item.targetMovieId);
  const movies = cachedIds.length
    ? await prisma.movie.findMany({
        where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { id: { in: cachedIds } }] },
        select: { id: true, slug: true, titleRu: true, year: true, type: true, posterUrl: true, quality: true, kpRating: true, imdbRating: true },
      })
    : [];

  const byId = new Map(movies.map((item) => [item.id, item]));
  const result = cached.map((item) => byId.get(item.targetMovieId)).filter((item): item is SimilarCardMovie => Boolean(item));

  if (result.length >= Math.min(limit, 6)) return result.slice(0, limit);

  const usedIds = [movie.id, ...result.map((item) => item.id)];
  const genreIds = movie.genres.map((item) => item.genreId);
  if (!genreIds.length) return result.slice(0, limit);

  const fallback = await prisma.movie.findMany({
    where: {
      AND: [
        vibixPublicMovieWhere,
        buildDefaultCatalogCountryWhere(),
        { id: { notIn: usedIds }, type: movie.type },
        { genres: { some: { genreId: { in: genreIds } } } },
      ],
    },
    select: { id: true, slug: true, titleRu: true, year: true, type: true, posterUrl: true, quality: true, kpRating: true, imdbRating: true },
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take: limit - result.length,
  });

  return [...result, ...fallback].slice(0, limit);
}

export default async function WatchPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();

  const countries = extractCountries(movie.country);
  const primaryGenre = movie.genres[0]?.genre;
  const similar = await getWatchSimilarMovies(movie, 12);
  const description = movie.description.trim() || "Описание скоро появится";
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
              <Fact label="Жанр">{primaryGenre ? <Link href={genrePath(primaryGenre)}>{primaryGenre.name}</Link> : "—"}</Fact>
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
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">{similarTitle}</h2>
          <Link href={similarPath(movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link>
        </div>
        {similar.length ? <div className="movie-grid">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div> : <div className="mf-panel p-5 text-[#a1a1aa]">Похожие {contentTypeSingleLower} скоро появятся.</div>}
      </section>

      <VibixBanner slot="movie_bottom" size="680x200" />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-2.5"><dt className="text-[10px] uppercase tracking-wider text-[#71717a]">{label}</dt><dd className="mt-1 truncate text-white">{children}</dd></div>;
}
