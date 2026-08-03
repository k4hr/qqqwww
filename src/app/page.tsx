import { ContentType, type Movie, type Prisma } from "@prisma/client";
import Link from "next/link";
import { ClientLibrary } from "@/components/client-library";
import { TodayPicker } from "@/components/discovery/today-picker";
import { HomeMatchPromo } from "@/components/home-match-promo";
import { HomeBand } from "@/components/home-band";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { hasPlayableSource, isValidCinematicImage } from "@/lib/home-quality-score";
import { isAdultLikeTitle } from "@/lib/catalog-safety";
import { prisma } from "@/lib/prisma";
import { getDiscoveryRecommendations } from "@/lib/discovery/recommendations";
import { getPublicBackdropMap } from "@/lib/movie-artwork";


export const revalidate = 120;

export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

const HOME_SECTION_LIMIT = 7;
const HOMEPAGE_CANDIDATE_LIMIT = 120;

function HomeTaxonomy() {
  const links = [
    ["/genre/boeviki", "Боевики"],
    ["/genre/trillery", "Триллеры"],
    ["/genre/fantastika", "Фантастика"],
    ["/genre/komedii", "Комедии"],
    ["/genre/dramy", "Драмы"],
    ["/collections/filmy-smotret-online", "Все коллекции"],
  ];
  return (
    <section className="rf-section border-t border-white/[.07] pt-8">
      <div className="rf-section-header">
        <h2 className="rf-section-title">Выбрать по настроению</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map(([href, label]) => <Link key={href} href={href} className="rf-filter">{label}</Link>)}
      </div>
    </section>
  );
}

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

function normalizeArtworkUrl(url?: string | null) {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    parsed.search = "";
    return decodeURIComponent(parsed.toString()).toLocaleLowerCase("en-US");
  } catch {
    return raw.split(/[?#]/, 1)[0].toLocaleLowerCase("en-US");
  }
}

function movieBackdropFallback(movie: Pick<Movie, "backdropUrl" | "posterUrl">) {
  if (!isValidCinematicImage(movie.backdropUrl)) return null;
  const backdrop = normalizeArtworkUrl(movie.backdropUrl);
  const poster = normalizeArtworkUrl(movie.posterUrl);
  if (!backdrop || (poster && backdrop === poster)) return null;
  return movie.backdropUrl;
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
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    legacyCandidates,
  ] = await Promise.all([
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
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    legacyCandidates,
  };
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [homeMovies, todayMovies] = await Promise.all([
    getHomeMovies(currentYear),
    getDiscoveryRecommendations({ filters: { mood: "evening" }, limit: 10 }),
  ]);
  const {
    bestMovieCandidates,
    eligibleSeries,
    eligibleCartoons,
    eligibleAnime,
    trendingCandidates,
    recentHotFallback,
    eligibleNewest,
    eligibleClassics,
    legacyCandidates,
  } = homeMovies;

  const legacySafe = legacyCandidates.filter(isLegacyHomeSafe).sort((a, b) => legacyScore(b) - legacyScore(a));
  const strongLegacy = legacySafe.filter(isStrongKnownTitle);

  const trendingPreferred = trendingCandidates
    .sort((a, b) => trendRankScore(b, currentYear) - trendRankScore(a, currentYear));
  const trendingFallback = recentHotFallback
    .sort((a, b) => trendRankScore(b, currentYear) - trendRankScore(a, currentYear));
  const trending = fillMovies(trendingPreferred, trendingFallback);

  const trendingIds = new Set(trending.map((movie) => movie.id));

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

  const homeSectionMovies = uniqueById([
    ...trending,
    ...newest,
    ...popularSeries,
    ...bestMovies,
    ...popularAnime,
    ...popularCartoons,
    ...classics,
    ...todayMovies,
  ]);
  const backgroundPriority = uniqueById([
    ...trending.slice(0, 2),
    ...newest.slice(0, 2),
    ...todayMovies.slice(0, 2),
    ...popularSeries.slice(0, 2),
    ...bestMovies.slice(0, 2),
    ...popularAnime.slice(0, 2),
    ...popularCartoons.slice(0, 2),
    ...classics.slice(0, 2),
    ...homeSectionMovies,
  ]);
  const homeSectionBackdrops = await getPublicBackdropMap(
    backgroundPriority.map((movie) => movie.id),
  );
  const sectionBackdrop = (movies: Array<Pick<Movie, "id" | "backdropUrl" | "posterUrl">>) => {
    for (const movie of movies) {
      const artwork = homeSectionBackdrops.get(movie.id) ?? movieBackdropFallback(movie);
      if (artwork) return artwork;
    }
    return null;
  };
  const todayBackdrop = sectionBackdrop(todayMovies);

  return <div className="rf-home-page pb-8">
    <HomeBand artworkUrl={sectionBackdrop(trending)} artworkAlt="" tone="red">
      <SectionGrid title="Сейчас популярно" href="/trending" movies={trending} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(newest)} artworkAlt="" tone="neutral">
      <SectionGrid title="Новинки" href="/latest" movies={newest} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand artworkUrl={todayBackdrop} artworkAlt="" tone="amber">
      <TodayPicker initialMood="evening" initialMovies={todayMovies} />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(popularSeries)} artworkAlt="" tone="blue">
      <SectionGrid title="Популярные сериалы" href="/series/popular" movies={popularSeries} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(bestMovies)} artworkAlt="" tone="red" compact>
      <HomeMatchPromo movies={uniqueById([...bestMovies, ...trending]).slice(0, 4)} />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(bestMovies)} artworkAlt="" tone="neutral">
      <SectionGrid title="Лучшие фильмы" href="/films/top-100" movies={bestMovies} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(popularAnime)} artworkAlt="" tone="violet">
      <SectionGrid title="Аниме" href="/anime/popular" movies={popularAnime} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand artworkUrl={sectionBackdrop(popularCartoons)} artworkAlt="" tone="blue">
      <SectionGrid title="Мультфильмы" href="/cartoons/popular" movies={popularCartoons} showSorts={false} mobileCarousel />
    </HomeBand>
    <HomeBand tone="red" compact>
      <HomeTaxonomy />
    </HomeBand>

    <div className="container">
      <ClientLibrary mode="recent-home" />
      <div className="home-catalog-ad"><VibixBanner slot="home_after_popular" size="728x90" /></div>
    </div>

    <HomeBand artworkUrl={sectionBackdrop(classics)} artworkAlt="" tone="amber">
      <SectionGrid title="Классика и хиты" href="/top" movies={classics} showSorts={false} mobileCarousel />
    </HomeBand>

    <div className="container">
      <section className="mt-14 max-w-3xl border-t border-white/[.07] pt-7 text-sm leading-7 text-[#74757d]">
        REDFILM помогает выбрать фильм, сериал, мультфильм или аниме по настроению, рейтингу и году. В каталоге доступны описания, подборки и похожие истории.
      </section>
    </div>
  </div>;
}
