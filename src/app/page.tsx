import { ContentType, type Movie, type Prisma } from "@prisma/client";
import { ClientLibrary } from "@/components/client-library";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { hasPlayableSource, isValidCinematicImage } from "@/lib/home-quality-score";
import { isAdultLikeTitle } from "@/lib/catalog-safety";
import { prisma } from "@/lib/prisma";
import { getHomeSelectionForHero } from "@/lib/home-selection";


export const revalidate = 120;

export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

const HOME_SECTION_LIMIT = 8;
const HOMEPAGE_CANDIDATE_LIMIT = 120;

function maxRating(movie: Pick<Movie, "kpRating" | "imdbRating" | "tmdbRating">) {
  return Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
}

function maxVotes(movie: Pick<Movie, "kpVotes" | "imdbVotes" | "tmdbVotes">) {
  return Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
}

function dateMs(value?: Date | string | null) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function legacyScore(movie: Movie) {
  const votes = maxVotes(movie);
  const rating = maxRating(movie);
  const recency = Math.max(0, movie.year - (new Date().getFullYear() - 5)) * 2;
  return Math.log10(1 + votes) * 12
    + rating * 5
    + recency
    + (isValidCinematicImage(movie.backdropUrl) ? 8 : 0)
    + (hasPlayableSource(movie) ? 20 : 0)
    + (isValidCinematicImage(movie.posterUrl) ? 10 : 0);
}

function trendRankScore(movie: Movie, currentYear: number) {
  const votes = maxVotes(movie);
  const rating = maxRating(movie);
  const yearBonus = movie.year >= currentYear + 1 ? 34
    : movie.year >= currentYear ? 30
      : movie.year >= currentYear - 1 ? 24
        : movie.year >= currentYear - 2 ? 16
          : 0;
  const uploadedBonus = Math.min(14, dateMs(movie.vibixUploadedAt ?? movie.createdAt) / 86_400_000_000_000);
  return movie.freshScore * 1.15
    + movie.trendScore
    + yearBonus
    + uploadedBonus
    + Math.log10(1 + votes) * 6
    + rating * 3
    + movie.franchiseScore * 0.7
    + (isValidCinematicImage(movie.backdropUrl) ? 4 : 0);
}

function bestMovieRankScore(movie: Movie) {
  const votes = maxVotes(movie);
  const rating = maxRating(movie);
  return movie.topScore * 1.25
    + movie.qualityScore
    + movie.evergreenScore * 0.75
    + Math.log10(1 + votes) * 14
    + rating * 9
    + movie.franchiseScore
    + movie.actorPowerScore * 0.5
    + (isValidCinematicImage(movie.backdropUrl) ? 4 : 0)
    + (movie.year <= new Date().getFullYear() - 3 ? 4 : 0);
}

function isRussianTitle(movie: Pick<Movie, "titleRu">) {
  return /[а-яё]/iu.test(movie.titleRu);
}

function hasBlockedAdultTag(movie: Pick<Movie, "vibixTags">) {
  return movie.vibixTags.some((tag) => /adult|erotic|porn|эрот|порно/iu.test(tag));
}

function isLegacyHomeSafe(movie: Movie) {
  return isRussianTitle(movie)
    && isValidCinematicImage(movie.posterUrl)
    && hasPlayableSource(movie)
    && !isAdultLikeTitle(movie)
    && !hasBlockedAdultTag(movie);
}

function isStrongKnownTitle(movie: Movie) {
  const votes = maxVotes(movie);
  const rating = maxRating(movie);
  return votes >= 10_000 || (rating >= 7 && votes >= 1_000) || movie.franchiseScore >= 10 || movie.actorPowerScore >= 12;
}

function uniqueById<T extends Pick<Movie, "id">>(movies: T[]) {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}

function withoutIds<T extends Pick<Movie, "id">>(movies: T[], ids: Set<string>) {
  return movies.filter((movie) => !ids.has(movie.id));
}

function fillMovies<T extends Movie>(preferred: T[], fallback: T[], limit = HOME_SECTION_LIMIT) {
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

  const posterPlayableWhere: Prisma.MovieWhereInput = {
    ...publicWhere,
    ...playableWhere,
    posterUrl: { not: null },
  };

  const [
    heroMovies,
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    heroFallback,
    legacyCandidates,
  ] = await Promise.all([
    prisma.movie.findMany({
      where: { ...publicWhere, isHeroEligible: true },
      orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 8,
    }),
    prisma.movie.findMany({
      where: {
        ...publicWhere,
        posterUrl: { not: null },
        type: ContentType.MOVIE,
        AND: [playableWhere],
        OR: [
          { isTopEligible: true },
          { isEvergreenEligible: true },
          { kpVotes: { gte: 10_000 } },
          { imdbVotes: { gte: 10_000 } },
          { kpRating: { gte: 7 } },
          { imdbRating: { gte: 7 } },
        ],
      },
      orderBy: [
        { topScore: "desc" },
        { qualityScore: "desc" },
        { evergreenScore: "desc" },
        { kpVotes: "desc" },
        { imdbVotes: "desc" },
        { kpRating: "desc" },
      ],
      take: HOMEPAGE_CANDIDATE_LIMIT,
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
      where: {
        ...publicWhere,
        posterUrl: { not: null },
        year: { gte: currentYear - 2 },
        AND: [playableWhere],
        OR: [
          { isTrendingEligible: true },
          { isFreshEligible: true },
          { freshScore: { gt: 0 } },
          { trendScore: { gt: 0 } },
        ],
      },
      orderBy: [
        { freshScore: "desc" },
        { trendScore: "desc" },
        { vibixUploadedAt: "desc" },
        { homeScore: "desc" },
      ],
      take: HOMEPAGE_CANDIDATE_LIMIT,
    }),
    prisma.movie.findMany({
      where: {
        ...publicWhere,
        posterUrl: { not: null },
        year: { gte: currentYear - 2 },
        AND: [playableWhere],
        OR: [
          { kpVotes: { gte: 1 } },
          { imdbVotes: { gte: 1 } },
          { kpRating: { gte: 5.5 } },
          { imdbRating: { gte: 5.5 } },
        ],
      },
      orderBy: [
        { vibixUploadedAt: "desc" },
        { trendScore: "desc" },
        { homeScore: "desc" },
        { kpVotes: "desc" },
        { imdbVotes: "desc" },
      ],
      take: HOMEPAGE_CANDIDATE_LIMIT,
    }),
    prisma.movie.findMany({
      where: { ...posterPlayableWhere, isHomeEligible: true, year: { in: [currentYear - 1, currentYear, currentYear + 1] } },
      orderBy: [{ freshScore: "desc" }, { trendScore: "desc" }, { homeScore: "desc" }, { vibixUploadedAt: "desc" }],
      take: 24,
    }),
    prisma.movie.findMany({
      where: {
        ...posterPlayableWhere,
        isEvergreenEligible: true,
        year: { lte: currentYear - 5 },
      },
      orderBy: [{ evergreenScore: "desc" }, { topScore: "desc" }, { qualityScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
      take: 36,
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
      where: posterPlayableWhere,
      orderBy: [
        { homeScore: "desc" },
        { topScore: "desc" },
        { qualityScore: "desc" },
        { kpVotes: "desc" },
        { imdbVotes: "desc" },
        { kpRating: "desc" },
        { imdbRating: "desc" },
        { year: "desc" },
      ],
      take: 240,
    }),
  ]);

  return {
    heroMovies,
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    heroFallback,
    legacyCandidates,
  };
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [homeMovies, manualSelection] = await Promise.all([
    getHomeMovies(currentYear),
    getHomeSelectionForHero(),
  ]);
  const {
    heroMovies,
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    heroFallback,
    legacyCandidates,
  } = homeMovies;

  const legacySafe = legacyCandidates.filter(isLegacyHomeSafe).sort((a, b) => legacyScore(b) - legacyScore(a));
  const strongLegacy = legacySafe.filter(isStrongKnownTitle);

  const legacyHero = legacySafe.filter((movie) => isValidCinematicImage(movie.backdropUrl));
  const autoFeatured = fillMovies(
    heroMovies,
    [...heroFallback.filter((movie) => isRussianTitle(movie) && isValidCinematicImage(movie.posterUrl) && isValidCinematicImage(movie.backdropUrl) && hasPlayableSource(movie)), ...legacyHero],
    manualSelection.settings.limit,
  );

  const manualFeatured = manualSelection.movies.filter((movie) => isValidCinematicImage(movie.posterUrl) || isValidCinematicImage(movie.backdropUrl));
  const featured = manualSelection.settings.isEnabled && manualSelection.settings.mode === "MANUAL"
    ? (manualFeatured.length ? manualFeatured.slice(0, manualSelection.settings.limit) : autoFeatured)
    : manualSelection.settings.isEnabled && manualSelection.settings.mode === "MIXED"
      ? fillMovies(manualFeatured, autoFeatured, manualSelection.settings.limit)
      : autoFeatured;

  const featuredIds = new Set(featured.map((movie) => movie.id));

  const trendingPreferred = trendingCandidates
    .filter((movie) => !featuredIds.has(movie.id))
    .sort((a, b) => trendRankScore(b, currentYear) - trendRankScore(a, currentYear));
  const trendingFallback = recentHotFallback
    .filter((movie) => !featuredIds.has(movie.id))
    .sort((a, b) => trendRankScore(b, currentYear) - trendRankScore(a, currentYear));
  const trending = fillMovies(trendingPreferred, trendingFallback);

  const trendingIds = new Set([...featuredIds, ...trending.map((movie) => movie.id)]);

  const bestMoviesPreferred = bestMovieCandidates
    .filter((movie) => !trendingIds.has(movie.id))
    .sort((a, b) => bestMovieRankScore(b) - bestMovieRankScore(a));
  const bestMoviesFallback = strongLegacy
    .filter((movie) => movie.type === ContentType.MOVIE && !trendingIds.has(movie.id))
    .sort((a, b) => bestMovieRankScore(b) - bestMovieRankScore(a));
  const bestMovies = fillMovies(bestMoviesPreferred, bestMoviesFallback);

  const bestMovieIds = new Set([...trendingIds, ...bestMovies.map((movie) => movie.id)]);

  const popularSeries = fillMovies(
    withoutIds(eligibleSeries, bestMovieIds),
    withoutIds(legacySafe.filter((movie) => movie.type === ContentType.SERIES), bestMovieIds),
  );
  const popularCartoons = fillMovies(
    withoutIds(eligibleCartoons, bestMovieIds),
    withoutIds(legacySafe.filter((movie) => movie.type === ContentType.CARTOON), bestMovieIds),
  );
  const popularAnime = fillMovies(
    withoutIds(eligibleAnime, bestMovieIds),
    withoutIds(legacySafe.filter((movie) => movie.type === ContentType.ANIME), bestMovieIds),
  );
  const newest = fillMovies(
    withoutIds(eligibleNewest, bestMovieIds),
    withoutIds(legacySafe.filter((movie) => [currentYear - 1, currentYear, currentYear + 1].includes(movie.year)), bestMovieIds),
  );
  const classics = fillMovies(
    withoutIds(eligibleClassics, bestMovieIds),
    withoutIds(strongLegacy.filter((movie) => movie.year <= currentYear - 5), bestMovieIds),
  );

  const featuredForClient = featured.slice(0, 5).map((movie) => ({
    id: movie.id,
    slug: movie.slug,
    titleRu: movie.titleRu,
    description: movie.description,
    year: movie.year,
    quality: movie.quality,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
  }));

  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={featuredForClient} />
    <SectionGrid title="В тренде" href="/trending" movies={trending} showSorts={false} mobileCarousel />
    <SectionGrid title="Лучшие фильмы" href="/films/top-100" movies={bestMovies} showSorts={false} mobileCarousel />
    <ClientLibrary mode="recent-home" />
    <SectionGrid title="Популярные сериалы" href="/series/popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title="Новинки" href="/latest" movies={newest} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные мультфильмы" href="/cartoons/popular" movies={popularCartoons} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярное аниме" href="/anime/popular" movies={popularAnime} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner slot="home_after_popular" size="728x90" /></div>
    <SectionGrid title="Классика и хиты" href="/top" movies={classics} showSorts={false} mobileCarousel />
  </div>;
}
