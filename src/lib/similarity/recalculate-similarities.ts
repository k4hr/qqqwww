import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { movieSeoInclude, type SeoMovie } from "@/lib/seo-pages";
import { buildSimilarityCandidateWhere } from "@/lib/similar";
import { buildCollectionSlug, normalizeMovieBaseTitle } from "@/lib/seo-slugs";
import { getTmdbCollectionMembers, getTmdbDetails, getTmdbKeywords, getTmdbRecommendations, getTmdbSimilar } from "@/lib/tmdb";
import { buildSimilarityProfile } from "@/lib/similarity/similarity-profile";
import { buildSimilarityReasonsJson, parseSimilarityReasonsJson } from "@/lib/similarity/similarity-reasons";
import {
  calculateSimilarityScore,
  isStrictSimilarityMatch,
  SIMILARITY_ALGORITHM_VERSION,
  type SimilarityScoreResult,
} from "@/lib/similarity/similarity-score";

export type SimilarityRecalculateOptions = {
  limit?: number;
  offset?: number;
  targetLimit?: number;
  minScore?: number;
  sourceMovieId?: string;
};

export type SimilarityRecalculateResult = {
  processed: number;
  sources: number;
  saved: number;
  deleted: number;
  errors: number;
  examples: Array<{ source: string; saved: number }>;
};

type CandidateWithSources = {
  movie: SeoMovie;
  sources: string[];
};

const tmdbSignalCache = new Map<string, Promise<{ recommendations: string[]; similar: string[]; keywords: string[]; collection: string[] }>>();

function candidateWhere(source: SeoMovie, extra: Prisma.MovieWhereInput): Prisma.MovieWhereInput {
  return {
    AND: [
      vibixPublicMovieWhere,
      buildDefaultCatalogCountryWhere(),
      { id: { not: source.id } },
      extra,
    ],
  };
}

async function getTmdbSignals(source: SeoMovie) {
  if (!source.tmdbId) return { recommendations: [], similar: [], keywords: [], collection: [] };
  const cacheKey = `${source.type}:${source.tmdbId}`;
  const cached = tmdbSignalCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const recommendations = await getTmdbRecommendations(source.tmdbId!, source.type);
    const similar = await getTmdbSimilar(source.tmdbId!, source.type);
    const keywords = await getTmdbKeywords(source.tmdbId!, source.type);
    const collectionId = await getSourceTmdbCollectionId(source);
    const collection = collectionId ? await getTmdbCollectionMembers(collectionId) : [];

    return {
      recommendations: recommendations.map((item) => String(item.id)).slice(0, 40),
      similar: similar.map((item) => String(item.id)).slice(0, 40),
      keywords: keywords.map((item) => item.name).filter(Boolean).slice(0, 24),
      collection: collection.map((item) => String(item.id)).filter((id) => id !== source.tmdbId).slice(0, 80),
    };
  })();

  tmdbSignalCache.set(cacheKey, promise);
  return promise;
}

async function getSourceTmdbCollectionId(source: SeoMovie) {
  if (!source.tmdbId || !process.env.TMDB_API_KEY) return null;
  try {
    const details = await getTmdbDetails(source.tmdbId, source.type);
    return details.collectionId ?? null;
  } catch (error) {
    console.warn("[Similarity] Optional TMDB collection lookup failed", error);
    return null;
  }
}

function addCandidates(target: Map<string, CandidateWithSources>, movies: SeoMovie[], sourceLabel: string) {
  for (const movie of movies) {
    const existing = target.get(movie.id);
    if (existing) {
      if (!existing.sources.includes(sourceLabel)) existing.sources.push(sourceLabel);
      continue;
    }
    target.set(movie.id, { movie, sources: [sourceLabel] });
  }
}

async function collectSimilarityCandidates(source: SeoMovie): Promise<CandidateWithSources[]> {
  const profile = buildSimilarityProfile(source);
  const target = new Map<string, CandidateWithSources>();
  const baseTitle = normalizeMovieBaseTitle(source.titleRu);
  const baseSlug = buildCollectionSlug(baseTitle).replace(/-vse-chasti$/, "");
  const genreIds = source.genres.map((item) => item.genreId);
  const castPersonIds = source.cast.slice(0, 6).map((item) => item.personId);
  const tmdbSignals = await getTmdbSignals(source);

  if (baseTitle.length >= 4) {
    const collection = await prisma.movie.findMany({
      where: candidateWhere(source, {
        OR: [
          { slug: { startsWith: baseSlug } },
          { titleRu: { contains: baseTitle, mode: "insensitive" } },
          { titleOriginal: { contains: baseTitle, mode: "insensitive" } },
        ],
      }),
      include: movieSeoInclude,
      orderBy: [{ year: "asc" }, { kpRating: "desc" }],
      take: 50,
    });
    addCandidates(target, collection, "SAME_COLLECTION");
  }

  if (tmdbSignals.recommendations.length) {
    const recommendations = await prisma.movie.findMany({
      where: candidateWhere(source, { tmdbId: { in: tmdbSignals.recommendations } }),
      include: movieSeoInclude,
      take: 80,
    });
    addCandidates(target, recommendations, "TMDB_RECOMMENDATIONS");
  }

  if (tmdbSignals.collection.length) {
    const collectionMovies = await prisma.movie.findMany({
      where: candidateWhere(source, { type: source.type, tmdbId: { in: tmdbSignals.collection } }),
      include: movieSeoInclude,
      take: 80,
    });
    addCandidates(target, collectionMovies, "TMDB_COLLECTION");
  }

  if (tmdbSignals.similar.length) {
    const similar = await prisma.movie.findMany({
      where: candidateWhere(source, { tmdbId: { in: tmdbSignals.similar } }),
      include: movieSeoInclude,
      take: 80,
    });
    addCandidates(target, similar, "TMDB_SIMILAR");
  }

  const keywords = Array.from(new Set([...profile.hintKeywords, ...tmdbSignals.keywords].map((item) => item.trim()).filter((item) => item.length >= 4))).slice(0, 22);
  if (keywords.length) {
    const keywordCandidates = await prisma.movie.findMany({
      where: candidateWhere(source, {
        OR: keywords.flatMap((keyword) => [
          { titleRu: { contains: keyword, mode: "insensitive" } },
          { titleOriginal: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
          { vibixTags: { has: keyword } },
        ]),
      }),
      include: movieSeoInclude,
      orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
      take: 120,
    });
    addCandidates(target, keywordCandidates, "KEYWORDS");
  }

  const storyWhere = buildSimilarityCandidateWhere(source);
  const storyCandidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), storyWhere] },
    include: movieSeoInclude,
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take: 180,
  });
  addCandidates(target, storyCandidates, "STORY_AND_THEME");

  if (source.director || castPersonIds.length) {
    const peopleCandidates = await prisma.movie.findMany({
      where: candidateWhere(source, {
        OR: [
          ...(source.director ? [{ director: { equals: source.director, mode: "insensitive" as const } }] : []),
          ...(castPersonIds.length ? [{ cast: { some: { personId: { in: castPersonIds } } } }] : []),
        ],
      }),
      include: movieSeoInclude,
      orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    addCandidates(target, peopleCandidates, "PEOPLE");
  }

  if (genreIds.length) {
    const metadataCandidates = await prisma.movie.findMany({
      where: candidateWhere(source, {
        AND: [
          { type: source.type },
          { genres: { some: { genreId: { in: genreIds } } } },
          { year: { gte: source.year - 12, lte: source.year + 12 } },
        ],
      }),
      include: movieSeoInclude,
      orderBy: [{ topScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
      take: 150,
    });
    addCandidates(target, metadataCandidates, "METADATA_FALLBACK");
  }

  return [...target.values()];
}

function rerankDiverse(items: Array<{ candidate: SeoMovie; result: SimilarityScoreResult; sources: string[] }>, limit: number) {
  const selected: typeof items = [];
  const franchiseCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const decadeCounts = new Map<number, number>();
  const themeCounts = new Map<string, number>();

  for (const item of items) {
    const profile = buildSimilarityProfile(item.candidate);
    const franchiseKey = [...profile.franchiseIds].sort().join("|") || profile.baseTitle;
    const directorKey = profile.directorName;
    const decade = Math.floor(item.candidate.year / 10) * 10;
    const actorKeys = [...profile.castNames].slice(0, 2);
    const themeKeys = [...profile.clusterIds].slice(0, 2);

    if (franchiseKey && (franchiseCounts.get(franchiseKey) ?? 0) >= 4) continue;
    if (directorKey && (directorCounts.get(directorKey) ?? 0) >= 3) continue;
    if ((decadeCounts.get(decade) ?? 0) >= 5) continue;
    if (actorKeys.some((key) => (actorCounts.get(key) ?? 0) >= 3)) continue;
    if (themeKeys.some((key) => (themeCounts.get(key) ?? 0) >= 6)) continue;

    selected.push(item);
    if (franchiseKey) franchiseCounts.set(franchiseKey, (franchiseCounts.get(franchiseKey) ?? 0) + 1);
    if (directorKey) directorCounts.set(directorKey, (directorCounts.get(directorKey) ?? 0) + 1);
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    for (const key of actorKeys) actorCounts.set(key, (actorCounts.get(key) ?? 0) + 1);
    for (const key of themeKeys) themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
    if (selected.length >= limit) break;
  }

  return selected;
}

async function recalculateOneMovie(source: SeoMovie, targetLimit: number, minScore: number) {
  const sourceProfile = buildSimilarityProfile(source);
  const candidates = await collectSimilarityCandidates(source);

  const ranked = candidates
    .map(({ movie, sources }) => {
      const candidateProfile = buildSimilarityProfile(movie);
      let result = calculateSimilarityScore(source, movie, sourceProfile, candidateProfile);

      if (sources.includes("TMDB_COLLECTION")) {
        result = {
          ...result,
          score: result.score + 980,
          audienceScore: result.audienceScore + 520,
          bucket: "franchise",
          strongSignals: result.strongSignals + 2,
          reasons: Array.from(new Set(["та же коллекция TMDB", ...result.reasons])).slice(0, 6),
          components: { ...result.components, franchiseScore: result.components.franchiseScore + 980 },
          rejectionReason: result.rejectionReason === "no_strong_signal" ? undefined : result.rejectionReason,
        };
      }

      if (sources.includes("TMDB_RECOMMENDATIONS")) {
        result = {
          ...result,
          score: result.score + 700,
          audienceScore: result.audienceScore + 400,
          bucket: "external_recommendation",
          reasons: Array.from(new Set(["рекомендация TMDB", ...result.reasons])).slice(0, 6),
          components: { ...result.components, externalScore: result.components.externalScore + 700 },
          rejectionReason: result.strongSignals > 0 && result.rejectionReason === "no_strong_signal" ? undefined : result.rejectionReason,
        };
      } else if (sources.includes("TMDB_SIMILAR")) {
        result = {
          ...result,
          score: result.score + 430,
          audienceScore: result.audienceScore + 240,
          bucket: result.bucket === "weak" ? "external_similar" : result.bucket,
          reasons: Array.from(new Set(["похожий фильм по TMDB", ...result.reasons])).slice(0, 6),
          components: { ...result.components, externalScore: result.components.externalScore + 430 },
          rejectionReason: result.strongSignals > 0 && result.rejectionReason === "no_strong_signal" ? undefined : result.rejectionReason,
        };
      }

      return { candidate: movie, result, sources };
    })
    .filter((item) => isStrictSimilarityMatch(item.result, minScore))
    .sort((a, b) => b.result.score - a.result.score || (b.candidate.kpRating ?? 0) - (a.candidate.kpRating ?? 0));

  const diverse = rerankDiverse(ranked, targetLimit);

  await prisma.$transaction(async (tx) => {
    await tx.movieSimilarity.deleteMany({ where: { sourceMovieId: source.id } });

    if (diverse.length) {
      await tx.movieSimilarity.createMany({
        data: diverse.map((item) => ({
          sourceMovieId: source.id,
          targetMovieId: item.candidate.id,
          score: item.result.score,
          audienceScore: item.result.audienceScore,
          bucket: item.result.bucket,
          reasonsJson: buildSimilarityReasonsJson(item.result, item.sources),
        })),
        skipDuplicates: true,
      });
    }

    await tx.movie.update({
      where: { id: source.id },
      data: {
        similarityDirty: false,
        similarityDirtyReason: null,
        similarityCalculatedAt: new Date(),
      },
    });
  });

  return { saved: diverse.length, deleted: 1 };
}

export async function recalculateMovieSimilarities(options: SimilarityRecalculateOptions = {}): Promise<SimilarityRecalculateResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 300, 5000));
  const offset = Math.max(0, options.offset ?? 0);
  const targetLimit = Math.max(6, Math.min(options.targetLimit ?? 24, 60));
  const minScore = Math.max(0, options.minScore ?? 180);

  const sources = options.sourceMovieId
    ? await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, { id: options.sourceMovieId }] }, include: movieSeoInclude, take: 1 })
    : await prisma.movie.findMany({
      where: vibixPublicMovieWhere,
      include: movieSeoInclude,
      orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
      skip: offset,
      take: limit,
    });

  const result: SimilarityRecalculateResult = { processed: 0, sources: sources.length, saved: 0, deleted: 0, errors: 0, examples: [] };

  for (const source of sources) {
    try {
      const one = await recalculateOneMovie(source, targetLimit, minScore);
      result.processed += 1;
      result.saved += one.saved;
      result.deleted += one.deleted;
      if (result.examples.length < 10) result.examples.push({ source: source.titleRu, saved: one.saved });
    } catch (error) {
      result.errors += 1;
      console.error(`[Similarity] Failed for ${source.titleRu}:`, error);
    }
  }

  return result;
}

export async function markAllMovieSimilaritiesDirty(reason = "manual_all") {
  return prisma.movie.updateMany({
    where: vibixPublicMovieWhere,
    data: { similarityDirty: true, similarityDirtyReason: `${reason}:v${SIMILARITY_ALGORITHM_VERSION}` },
  });
}

export async function countDirtyMovieSimilarities() {
  const [dirty, staleCached] = await Promise.all([
    prisma.movie.count({ where: { AND: [vibixPublicMovieWhere, { similarityDirty: true }] } }),
    prisma.movieSimilarity.findMany({
      select: { sourceMovieId: true, reasonsJson: true },
      distinct: ["sourceMovieId"],
      take: 2000,
    }),
  ]);
  const stale = staleCached.filter((item) => parseSimilarityReasonsJson(item.reasonsJson).algorithmVersion < SIMILARITY_ALGORITHM_VERSION).length;
  return dirty + stale;
}

export async function recalculateDirtyMovieSimilarities(options: SimilarityRecalculateOptions = {}): Promise<SimilarityRecalculateResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
  const targetLimit = Math.max(6, Math.min(options.targetLimit ?? 24, 60));
  const minScore = Math.max(0, options.minScore ?? 180);

  const staleCached = await prisma.movieSimilarity.findMany({
    select: { sourceMovieId: true, reasonsJson: true },
    distinct: ["sourceMovieId"],
    take: limit * 4,
  });
  const staleSourceIds = staleCached
    .filter((item) => parseSimilarityReasonsJson(item.reasonsJson).algorithmVersion < SIMILARITY_ALGORITHM_VERSION)
    .map((item) => item.sourceMovieId);

  const sources = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { OR: [{ similarityDirty: true }, { id: { in: staleSourceIds } }] }] },
    include: movieSeoInclude,
    orderBy: [
      { popularScore: "desc" },
      { kpRating: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  const result: SimilarityRecalculateResult = { processed: 0, sources: sources.length, saved: 0, deleted: 0, errors: 0, examples: [] };

  for (const source of sources) {
    try {
      const one = await recalculateOneMovie(source, targetLimit, minScore);
      result.processed += 1;
      result.saved += one.saved;
      result.deleted += one.deleted;
      if (result.examples.length < 10) result.examples.push({ source: source.titleRu, saved: one.saved });
    } catch (error) {
      result.errors += 1;
      await prisma.movie.update({
        where: { id: source.id },
        data: { similarityDirty: true, similarityDirtyReason: error instanceof Error ? error.message.slice(0, 180) : "similarity_error" },
      }).catch(() => null);
      console.error(`[Similarity] Failed for ${source.titleRu}:`, error);
    }
  }

  return result;
}

export async function debugMovieSimilarity(query: string, limit = 20) {
  const source = await prisma.movie.findFirst({
    where: {
      AND: [
        vibixPublicMovieWhere,
        {
          OR: [
            { id: query },
            { slug: query },
            { titleRu: { contains: query, mode: "insensitive" } },
            { titleOriginal: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    include: movieSeoInclude,
  });

  if (!source) return null;

  const sourceProfile = buildSimilarityProfile(source);
  const candidates = await collectSimilarityCandidates(source);

  const items = candidates
    .map(({ movie, sources }) => {
      const candidateProfile = buildSimilarityProfile(movie);
      const score = calculateSimilarityScore(source, movie, sourceProfile, candidateProfile);
      return {
        id: movie.id,
        slug: movie.slug,
        titleRu: movie.titleRu,
        titleOriginal: movie.titleOriginal,
        year: movie.year,
        type: movie.type,
        score: score.score,
        audienceScore: score.audienceScore,
        bucket: score.bucket,
        strongSignals: score.strongSignals,
        accepted: isStrictSimilarityMatch(score),
        rejectionReason: score.rejectionReason ?? null,
        penalties: score.penalties,
        components: score.components,
        candidateSources: sources,
        reasons: score.reasons,
        kpRating: movie.kpRating,
        imdbRating: movie.imdbRating,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    algorithmVersion: SIMILARITY_ALGORITHM_VERSION,
    tmdbAvailable: Boolean(process.env.TMDB_API_KEY),
    source: {
      id: source.id,
      slug: source.slug,
      titleRu: source.titleRu,
      titleOriginal: source.titleOriginal,
      year: source.year,
      type: source.type,
      profile: {
        franchises: [...sourceProfile.franchiseIds],
        clusters: [...sourceProfile.clusterIds],
        tags: [...sourceProfile.tagNames].slice(0, 20),
        hints: sourceProfile.hintKeywords.slice(0, 20),
      },
    },
    candidateCount: candidates.length,
    items,
  };
}
