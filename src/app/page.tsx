import { ContentType, type Movie } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ClientLibrary } from "@/components/client-library";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { hasPlayableSource, isValidCinematicImage } from "@/lib/home-quality-score";
import { isAdultLikeTitle } from "@/lib/catalog-safety";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

const getHomeMovies = unstable_cache(async (currentYear: number) => {
  const publicWhere = { isPublished: true, isCatalogAllowed: true, isHomeEligible: true } as const;
  return Promise.all([
    prisma.movie.findMany({ where: { ...publicWhere, isHeroEligible: true }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 8 }),
    prisma.movie.findMany({ where: { ...publicWhere, type: ContentType.MOVIE }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, type: ContentType.SERIES }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, isTrendingEligible: true }, orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, year: { in: [currentYear - 1, currentYear, currentYear + 1] } }, orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, isEvergreenEligible: true }, orderBy: [{ evergreenScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({
      where: { ...publicWhere, backdropUrl: { not: null }, OR: [{ kpVotes: { gte: 1_000 } }, { imdbVotes: { gte: 1_000 } }, { tmdbVotes: { gte: 1_000 } }] },
      orderBy: [{ homeScore: "desc" }, { qualityScore: "desc" }],
      take: 30,
    }),
    prisma.movie.findMany({
      where: {
        isPublished: true,
        isCatalogAllowed: true,
        posterUrl: { not: null },
        OR: [
          { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
          { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
        ],
      },
      orderBy: [{ kpVotes: "desc" }, { imdbVotes: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { year: "desc" }],
      take: 300,
    }),
  ]);
}, ["redfilm-home-scores-v2"], { revalidate: 120 });

function legacyScore(movie: Movie) {
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0);
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0);
  const recency = Math.max(0, movie.year - (new Date().getFullYear() - 5)) * 2;
  return Math.log10(1 + votes) * 12 + rating * 5 + recency + (isValidCinematicImage(movie.backdropUrl) ? 8 : 0);
}

function isLegacyHomeSafe(movie: Movie) {
  return /[а-яё]/iu.test(movie.titleRu)
    && isValidCinematicImage(movie.posterUrl)
    && hasPlayableSource(movie)
    && !isAdultLikeTitle(movie)
    && (movie.vibixLgbtContent ?? 0) <= 0
    && !movie.vibixTags.some((tag) => /adult|erotic|porn|lgbt|эрот|порно|лгбт/iu.test(tag));
}

function fillMovies<T extends Movie>(preferred: T[], fallback: T[], limit = 12) {
  return [...preferred, ...fallback]
    .filter((movie, index, all) => all.findIndex((item) => item.id === movie.id) === index)
    .slice(0, limit);
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [heroMovies, eligibleMovies, eligibleSeries, eligibleTrending, eligibleNewest, eligibleBest, heroFallback, legacyCandidates] = await getHomeMovies(currentYear);
  const legacySafe = legacyCandidates.filter(isLegacyHomeSafe).sort((a, b) => legacyScore(b) - legacyScore(a));
  const popularMovies = fillMovies(eligibleMovies, legacySafe.filter((movie) => movie.type === ContentType.MOVIE));
  const popularSeries = fillMovies(eligibleSeries, legacySafe.filter((movie) => movie.type === ContentType.SERIES));
  const trending = fillMovies(eligibleTrending, legacySafe);
  const newest = fillMovies(eligibleNewest, legacySafe.filter((movie) => [currentYear - 1, currentYear, currentYear + 1].includes(movie.year)));
  const best = fillMovies(eligibleBest, legacySafe);
  const legacyHero = legacySafe.filter((movie) => isValidCinematicImage(movie.backdropUrl));
  const featured = fillMovies(
    heroMovies,
    [...heroFallback.filter((movie) => /[а-яё]/iu.test(movie.titleRu) && isValidCinematicImage(movie.posterUrl) && isValidCinematicImage(movie.backdropUrl)), ...legacyHero],
    8,
  );
  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={featured} />
    <SectionGrid title="В тренде" href="/trending" movies={trending} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные фильмы" href="/movies?sort=popular" movies={popularMovies} showSorts={false} mobileCarousel />
    <ClientLibrary mode="recent-home" />
    <SectionGrid title="Популярные сериалы" href="/series?sort=popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title={`Новинки ${currentYear}`} href={`/year/${currentYear}`} movies={newest} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner size="728x90" /></div>
    <SectionGrid title="Проверенная классика" href="/top" movies={best} showSorts={false} mobileCarousel />
  </div>;
}
