import "server-only";

import { ContentType, MovieArtworkType, type Prisma } from "@prisma/client";
import { isSafeForHome } from "@/lib/catalog-safety";
import {
  defaultDiscoveryFilters,
  type DiscoveryFilters,
  type DiscoveryMood,
  type DiscoveryMovie,
  type MatchPreferences,
  normalizeDiscoveryMood,
  normalizeDiscoveryPeriod,
  normalizeDiscoveryRuntime,
  normalizeDiscoveryType,
} from "@/lib/discovery/types";
import { isWideBackdropArtwork, redfilmBackdropFallback } from "@/lib/movie-artwork";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";

const MAX_EXCLUDED_IDS = 250;
const MAX_PREFERENCE_KEYS = 60;

const discoveryMovieSelect = {
  id: true,
  slug: true,
  titleRu: true,
  titleOriginal: true,
  year: true,
  type: true,
  posterUrl: true,
  backdropUrl: true,
  quality: true,
  duration: true,
  kpRating: true,
  imdbRating: true,
  kpVotes: true,
  imdbVotes: true,
  description: true,
  country: true,
  homeScore: true,
  trendScore: true,
  qualityScore: true,
  popularScore: true,
  genres: { select: { genre: { select: { slug: true, name: true } } } },
  cast: {
    orderBy: { sortOrder: "asc" as const },
    take: 4,
    select: { person: { select: { nameRu: true } } },
  },
  artworks: {
    where: { type: MovieArtworkType.BACKDROP },
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }, { voteCount: "desc" as const }],
    take: 6,
    select: {
      url: true,
      width: true,
      height: true,
      aspectRatio: true,
      isPrimary: true,
      source: true,
    },
  },
} satisfies Prisma.MovieSelect;

type DiscoveryMovieRow = Prisma.MovieGetPayload<{ select: typeof discoveryMovieSelect }>;

const moodGenres: Record<DiscoveryMood, string[]> = {
  evening: [],
  action: ["boeviki", "trillery", "fantastika", "priklyucheniya"],
  comfort: ["komedii", "semeynye", "priklyucheniya", "fentezi"],
  deep: ["dramy", "detektivy", "kriminal", "istoricheskie"],
  new: [],
  light: ["komedii", "semeynye", "melodramy", "priklyucheniya"],
  tense: ["trillery", "boeviki", "detektivy", "kriminal"],
  dark: ["uzhasy", "trillery", "kriminal", "detektivy"],
  heartfelt: ["dramy", "melodramy", "semeynye", "biografii"],
  adventure: ["priklyucheniya", "boeviki", "fentezi"],
  fantastic: ["fantastika", "fentezi", "priklyucheniya"],
  unexpected: ["detektivy", "trillery", "fantastika", "fentezi"],
};

type RecommendationOptions = {
  filters?: Partial<DiscoveryFilters>;
  limit?: number;
  excludeIds?: string[];
  likedIds?: string[];
  dislikedIds?: string[];
  preferences?: Partial<MatchPreferences>;
  seed?: string;
};

function sanitizeIdList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 80))).slice(-limit);
}

function sanitizeWeights(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, weight]) => key.length <= 80 && typeof weight === "number" && Number.isFinite(weight))
      .slice(0, MAX_PREFERENCE_KEYS)
      .map(([key, weight]) => [key, Math.max(-12, Math.min(24, weight as number))]),
  );
}

export function normalizeDiscoveryFilters(value?: Partial<DiscoveryFilters> | null): DiscoveryFilters {
  return {
    type: normalizeDiscoveryType(value?.type),
    mood: normalizeDiscoveryMood(value?.mood),
    runtime: normalizeDiscoveryRuntime(value?.runtime),
    period: normalizeDiscoveryPeriod(value?.period),
    highRating: value?.highRating === true,
    popular: value?.popular === true,
    onlyNew: value?.onlyNew === true,
    randomGood: value?.randomGood === true,
  };
}

export function normalizeMatchPreferences(value?: Partial<MatchPreferences> | null): Partial<MatchPreferences> {
  return {
    genreWeights: sanitizeWeights(value?.genreWeights),
    typeWeights: sanitizeWeights(value?.typeWeights),
    decadeWeights: sanitizeWeights(value?.decadeWeights),
    countryWeights: sanitizeWeights(value?.countryWeights),
    runtimeBuckets: sanitizeWeights(value?.runtimeBuckets),
    runtimePreference: normalizeDiscoveryRuntime(value?.runtimePreference),
  };
}

function runtimeWhere(runtime: DiscoveryFilters["runtime"]): Prisma.MovieWhereInput {
  if (runtime === "UNDER_90") return { duration: { gt: 0, lte: 90 } };
  if (runtime === "UNDER_120") return { duration: { gt: 0, lte: 120 } };
  if (runtime === "OVER_120") return { duration: { gt: 120 } };
  return {};
}

function periodWhere(period: DiscoveryFilters["period"], onlyNew: boolean): Prisma.MovieWhereInput {
  const currentYear = new Date().getFullYear();
  if (onlyNew || period === "NEW") return { year: { gte: currentYear - 2 } };
  if (period === "2020S") return { year: { gte: 2020, lte: 2029 } };
  if (period === "2010S") return { year: { gte: 2010, lte: 2019 } };
  if (period === "CLASSIC") return { year: { lte: 1999 } };
  return {};
}

function seedNoise(seed: string, id: string) {
  let hash = 2166136261;
  for (const char of `${seed}:${id}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function decadeKey(year: number) {
  return `${Math.floor(year / 10) * 10}`;
}

function runtimeKey(duration: number | null) {
  if (!duration) return "UNKNOWN";
  if (duration <= 90) return "UNDER_90";
  if (duration <= 120) return "UNDER_120";
  return "OVER_120";
}

function franchiseKey(title: string) {
  return title
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\b(?:часть|сезон|глава|эпизод|part|chapter|season)\s*\d+\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-zа-я]+/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

function candidateScore(movie: DiscoveryMovieRow, filters: DiscoveryFilters, preferences: Partial<MatchPreferences>, seed: string) {
  const genres = movie.genres.map(({ genre }) => genre.slug);
  const preferredGenres = preferences.genreWeights ?? {};
  const typeWeights = preferences.typeWeights ?? {};
  const decadeWeights = preferences.decadeWeights ?? {};
  const countryWeights = preferences.countryWeights ?? {};
  const runtimeWeights = preferences.runtimeBuckets ?? {};
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0);
  const votes = Math.log10(1 + Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0));
  const learned = genres.reduce((sum, genre) => sum + (preferredGenres[genre] ?? 0), 0)
    + (typeWeights[movie.type] ?? 0) * 1.3
    + (decadeWeights[decadeKey(movie.year)] ?? 0)
    + (countryWeights[movie.country ?? ""] ?? 0) * 0.6
    + (runtimeWeights[runtimeKey(movie.duration)] ?? 0) * 0.8;
  const moodBonus = moodGenres[filters.mood].some((genre) => genres.includes(genre)) ? 24 : 0;
  const randomRange = filters.randomGood ? 28 : 5;
  return movie.homeScore * 1.25
    + movie.trendScore
    + movie.qualityScore * 0.7
    + movie.popularScore * (filters.popular ? 1.2 : 0.45)
    + rating * (filters.highRating ? 10 : 5)
    + votes * 7
    + learned * 8
    + moodBonus
    + seedNoise(seed, movie.id) * randomRange;
}

function resolveBackdrop(movie: DiscoveryMovieRow) {
  const valid = movie.artworks.filter(isWideBackdropArtwork);
  const primary = valid.find((artwork) => artwork.isPrimary) ?? valid[0];
  return primary?.url ?? redfilmBackdropFallback();
}

function explanationFor(movie: DiscoveryMovieRow, filters: DiscoveryFilters) {
  const labels: string[] = [];
  if (moodGenres[filters.mood].some((slug) => movie.genres.some(({ genre }) => genre.slug === slug))) labels.push(`Подходит под настроение: ${filters.mood === "tense" ? "напряжённое" : filters.mood === "dark" ? "мрачное" : filters.mood === "heartfelt" ? "душевное" : filters.mood === "fantastic" ? "фантастическое" : filters.mood === "adventure" ? "приключенческое" : filters.mood === "unexpected" ? "неожиданное" : "лёгкое"}`);
  if (filters.highRating) labels.push("Высокий рейтинг");
  if (filters.popular) labels.push("Популярно у зрителей");
  if (filters.period === "2020S") labels.push("Релиз 2020-х");
  if (movie.type === ContentType.SERIES) labels.push("Сериал на несколько вечеров");
  return labels.slice(0, 2).join(" · ") || "Подобрано по качеству и интересу зрителей";
}

function serializeMovie(movie: DiscoveryMovieRow, filters: DiscoveryFilters): DiscoveryMovie {
  return {
    id: movie.id,
    slug: movie.slug,
    titleRu: movie.titleRu,
    year: movie.year,
    type: movie.type,
    posterUrl: movie.posterUrl,
    backdropUrl: resolveBackdrop(movie),
    quality: movie.quality,
    duration: movie.duration,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
    description: movie.description,
    country: movie.country,
    genres: movie.genres.map(({ genre }) => genre.slug),
    cast: movie.cast.map(({ person }) => person.nameRu).filter(Boolean),
    homeScore: movie.homeScore,
    trendScore: movie.trendScore,
    explanation: explanationFor(movie, filters),
  };
}

function diversityRerank(rows: DiscoveryMovieRow[], target: number, filters: DiscoveryFilters) {
  const selected: DiscoveryMovieRow[] = [];
  const deferred: DiscoveryMovieRow[] = [];
  const franchiseCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();
  const typeCounts = new Map<ContentType, number>();
  let previousCast = new Set<string>();

  for (const movie of rows) {
    const franchise = franchiseKey(movie.titleRu);
    const genres = movie.genres.map(({ genre }) => genre.slug);
    const decade = decadeKey(movie.year);
    const cast = new Set(movie.cast.map(({ person }) => person.nameRu));
    const sameLead = [...cast].some((name) => previousCast.has(name));
    const tooSimilar = (franchise && (franchiseCounts.get(franchise) ?? 0) >= 2)
      || genres.some((genre) => (genreCounts.get(genre) ?? 0) >= Math.max(4, Math.ceil(target * 0.45)))
      || (decadeCounts.get(decade) ?? 0) >= Math.max(4, Math.ceil(target * 0.45))
      || (filters.type === "ANY" && (typeCounts.get(movie.type) ?? 0) >= Math.max(5, Math.ceil(target * 0.65)))
      || (selected.length > 0 && sameLead);
    if (tooSimilar) {
      deferred.push(movie);
      continue;
    }
    selected.push(movie);
    if (franchise) franchiseCounts.set(franchise, (franchiseCounts.get(franchise) ?? 0) + 1);
    for (const genre of genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    typeCounts.set(movie.type, (typeCounts.get(movie.type) ?? 0) + 1);
    previousCast = cast;
    if (selected.length >= target) return selected;
  }

  for (const movie of deferred) {
    if (!selected.some((item) => item.id === movie.id)) selected.push(movie);
    if (selected.length >= target) break;
  }
  return selected;
}

export async function getDiscoveryRecommendations(options: RecommendationOptions = {}) {
  const filters = normalizeDiscoveryFilters({ ...defaultDiscoveryFilters, ...options.filters });
  const limit = Math.min(Math.max(options.limit ?? 10, 6), 30);
  const excludeIds = sanitizeIdList(options.excludeIds, MAX_EXCLUDED_IDS);
  const preferences = normalizeMatchPreferences(options.preferences);
  const seed = typeof options.seed === "string" && options.seed.length <= 100 ? options.seed : `${Date.now()}`;
  const genres = moodGenres[filters.mood];
  const poolSize = Math.min(240, Math.max(80, limit * 10));
  const where: Prisma.MovieWhereInput = {
    AND: [
      vibixPublicMovieWhere,
      excludeIds.length ? { id: { notIn: excludeIds } } : {},
      filters.type !== "ANY" ? { type: filters.type } : {},
      runtimeWhere(filters.runtime),
      periodWhere(filters.period, filters.onlyNew === true),
      genres.length ? { genres: { some: { genre: { slug: { in: genres } } } } } : {},
      filters.highRating ? { OR: [{ kpRating: { gte: 6.5 } }, { imdbRating: { gte: 6.5 } }] } : {},
    ],
  };

  const rows = await prisma.movie.findMany({
    where,
    select: discoveryMovieSelect,
    orderBy: filters.onlyNew || filters.period === "NEW" || filters.mood === "new"
      ? [{ freshScore: "desc" }, { vibixUploadedAt: "desc" }, { trendScore: "desc" }]
      : filters.popular
        ? [{ popularScore: "desc" }, { trendScore: "desc" }, { homeScore: "desc" }]
        : [{ homeScore: "desc" }, { trendScore: "desc" }, { qualityScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
    take: poolSize,
  });

  const ranked = rows
    .filter((movie) => isSafeForHome(movie))
    .sort((a, b) => candidateScore(b, filters, preferences, seed) - candidateScore(a, filters, preferences, seed));
  const diverse = diversityRerank(ranked, limit, filters);
  return diverse.map((movie) => serializeMovie(movie, filters));
}

export async function getMatchCandidates({ limit = 24, type }: { limit?: number; type?: ContentType } = {}) {
  return getDiscoveryRecommendations({
    limit,
    filters: { ...defaultDiscoveryFilters, type: type ?? "ANY" },
    seed: "match-initial",
  });
}

export { ContentType, sanitizeIdList };
