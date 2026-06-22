import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { movieSeoInclude, type SeoMovie } from "@/lib/seo-pages";
import { buildSimilarityCandidateWhere } from "@/lib/similar";
import { buildSimilarityProfile } from "@/lib/similarity/similarity-profile";
import { calculateSimilarityScore } from "@/lib/similarity/similarity-score";

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

function reasonsJson(reasons: string[]) {
  return JSON.stringify(reasons.slice(0, 6));
}

async function recalculateOneMovie(source: SeoMovie, targetLimit: number, minScore: number) {
  const sourceProfile = buildSimilarityProfile(source);
  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), buildSimilarityCandidateWhere(source)] },
    include: movieSeoInclude,
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const ranked = candidates
    .map((candidate) => {
      const candidateProfile = buildSimilarityProfile(candidate);
      const result = calculateSimilarityScore(source, candidate, sourceProfile, candidateProfile);
      return { candidate, result };
    })
    .filter((item) => item.result.score >= minScore)
    .sort((a, b) => b.result.score - a.result.score || (b.candidate.kpRating ?? 0) - (a.candidate.kpRating ?? 0))
    .slice(0, targetLimit);

  await prisma.movieSimilarity.deleteMany({ where: { sourceMovieId: source.id } });

  if (!ranked.length) return { saved: 0, deleted: 1 };

  await prisma.movieSimilarity.createMany({
    data: ranked.map((item) => ({
      sourceMovieId: source.id,
      targetMovieId: item.candidate.id,
      score: item.result.score,
      audienceScore: item.result.audienceScore,
      bucket: item.result.bucket,
      reasonsJson: reasonsJson(item.result.reasons),
    })),
    skipDuplicates: true,
  });

  return { saved: ranked.length, deleted: 1 };
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
  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), buildSimilarityCandidateWhere(source)] },
    include: movieSeoInclude,
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take: 450,
  });

  const items = candidates
    .map((candidate) => {
      const candidateProfile = buildSimilarityProfile(candidate);
      const score = calculateSimilarityScore(source, candidate, sourceProfile, candidateProfile);
      return {
        id: candidate.id,
        slug: candidate.slug,
        titleRu: candidate.titleRu,
        titleOriginal: candidate.titleOriginal,
        year: candidate.year,
        type: candidate.type,
        score: score.score,
        audienceScore: score.audienceScore,
        bucket: score.bucket,
        reasons: score.reasons,
        kpRating: candidate.kpRating,
        imdbRating: candidate.imdbRating,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
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
        hints: sourceProfile.hintKeywords.slice(0, 20),
      },
    },
    items,
  };
}
