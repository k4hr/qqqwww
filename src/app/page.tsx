import { ContentType, type Movie, type Prisma } from "@prisma/client";
import { ClientLibrary } from "@/components/client-library";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { hasPlayableSource, isValidCinematicImage } from "@/lib/home-quality-score";
import { isAdultLikeTitle } from "@/lib/catalog-safety";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

function legacyScore(movie: Movie) {
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
  const recency = Math.max(0, movie.year - (new Date().getFullYear() - 5)) * 2;
  return Math.log10(1 + votes) * 12
    + rating * 5
    + recency
    + (isValidCinematicImage(movie.backdropUrl) ? 8 : 0)
    + (hasPlayableSource(movie) ? 20 : 0)
    + (isValidCinematicImage(movie.posterUrl) ? 10 : 0);
}

function isRussianTitle(movie: Pick<Movie, "titleRu">) {
  return /[а-яё]/iu.test(movie.titleRu);
}

function isLegacyHomeSafe(movie: Movie) {
  return isRussianTitle(movie)
    && isValidCinematicImage(movie.posterUrl)
    && hasPlayableSource(movie)
    && !isAdultLikeTitle(movie)
    && (movie.vibixLgbtContent ?? 0) <= 0
    && !movie.vibixTags.some((tag) => /adult|erotic|porn|lgbt|эрот|порно|лгбт/iu.test(tag));
}

function uniqueById<T extends Pick<Movie, "id">>(movies: T[]) {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}

function fillMovies<T extends Movie>(preferred: T[], fallback: T[], limit = 12) {
  return uniqueById([...preferred, ...fallback]).slice(0, limit);
}

async function getHomeMovies(currentYear: number) {
  const publicWhere: Prisma.MovieWhereInput = { isPublished: true, isCatalogAllowed: true };
  const playableWhere: Prisma.MovieWhereInput = {
    OR: [
      { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
      { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
    ],
  };

  const [heroMovies, eligibleMovies, eligibleSeries, eligibleCartoons, eligibleAnime, eligibleTrending, eligibleNewest, eligibleBest, heroFallback, legacyCandidates] = await Promise.all([
    prisma.movie.findMany({
      where: { ...publicWhere, isHeroEligible: true },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 8,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isHomeEligible: true, type: ContentType.MOVIE },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isHomeEligible: true, type: ContentType.SERIES },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isHomeEligible: true, type: ContentType.CARTOON },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isHomeEligible: true, type: ContentType.ANIME },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isTrendingEligible: true },
      orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isHomeEligible: true, year: { in: [currentYear - 1, currentYear, currentYear + 1] } },
      orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: { ...publicWhere, isEvergreenEligible: true },
      orderBy: [{ evergreenScore: "desc" }, { homeScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: {
        ...publicWhere,
        posterUrl: { not: null },
        backdropUrl: { not: null },
        AND: [
          playableWhere,
          { OR: [{ kpVotes: { gte: 1 } }, { imdbVotes: { gte: 1 } }, { kpRating: { gte: 6 } }, { imdbRating: { gte: 6 } }] },
        ],
      },
      orderBy: [{ homeScore: "desc" }, { qualityScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }, { kpRating: "desc" }],
      take: 80,
    }),
    prisma.movie.findMany({
      where: {
        ...publicWhere,
        ...playableWhere,
        posterUrl: { not: null },
      },
      orderBy: [{ homeScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { year: "desc" }],
      take: 500,
    }),
  ]);

  return { heroMovies, eligibleMovies, eligibleSeries, eligibleCartoons, eligibleAnime, eligibleTrending, eligibleNewest, eligibleBest, heroFallback, legacyCandidates };
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const { heroMovies, eligibleMovies, eligibleSeries, eligibleCartoons, eligibleAnime, eligibleTrending, eligibleNewest, eligibleBest, heroFallback, legacyCandidates } = await getHomeMovies(currentYear);

  const legacySafe = legacyCandidates.filter(isLegacyHomeSafe).sort((a, b) => legacyScore(b) - legacyScore(a));
  const popularMovies = fillMovies(eligibleMovies, legacySafe.filter((movie) => movie.type === ContentType.MOVIE));
  const popularSeries = fillMovies(eligibleSeries, legacySafe.filter((movie) => movie.type === ContentType.SERIES));
  const popularCartoons = fillMovies(eligibleCartoons, legacySafe.filter((movie) => movie.type === ContentType.CARTOON));
  const popularAnime = fillMovies(eligibleAnime, legacySafe.filter((movie) => movie.type === ContentType.ANIME));
  const trending = fillMovies(eligibleTrending, legacySafe);
  const newest = fillMovies(eligibleNewest, legacySafe.filter((movie) => [currentYear - 1, currentYear, currentYear + 1].includes(movie.year)));
  const best = fillMovies(eligibleBest, legacySafe);
  const legacyHero = legacySafe.filter((movie) => isValidCinematicImage(movie.backdropUrl));
  const featured = fillMovies(
    heroMovies,
    [...heroFallback.filter((movie) => isRussianTitle(movie) && isValidCinematicImage(movie.posterUrl) && isValidCinematicImage(movie.backdropUrl) && hasPlayableSource(movie)), ...legacyHero],
    8,
  );

  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={featured} />
    <SectionGrid title="В тренде" href="/trending" movies={trending} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные фильмы" href="/films/popular" movies={popularMovies} showSorts={false} mobileCarousel />
    <ClientLibrary mode="recent-home" />
    <SectionGrid title="Популярные сериалы" href="/series/popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные мультфильмы" href="/cartoons/popular" movies={popularCartoons} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярное аниме" href="/anime/popular" movies={popularAnime} showSorts={false} mobileCarousel />
    <SectionGrid title={`Новинки ${currentYear}`} href={`/year/${currentYear}`} movies={newest} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner size="728x90" /></div>
    <SectionGrid title="Проверенная классика" href="/top" movies={best} showSorts={false} mobileCarousel />
  </div>;
}
