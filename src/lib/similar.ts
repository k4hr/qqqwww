import type { Prisma } from "@prisma/client";
import { buildSimilarityProfile, type MovieWithSimilarityRelations } from "@/lib/similarity/similarity-profile";
import { calculateSimilarityScore } from "@/lib/similarity/similarity-score";

export type SimilarMovieResult = MovieWithSimilarityRelations & {
  similarityScore: number;
  similarityReasons: string[];
  similarityBucket?: string;
};

function intersectCount<T>(a: Set<T>, b: Set<T>) {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

export function calculateSimilarity(source: MovieWithSimilarityRelations, candidate: MovieWithSimilarityRelations): { score: number; reasons: string[] } {
  const sourceProfile = buildSimilarityProfile(source);
  const candidateProfile = buildSimilarityProfile(candidate);
  const result = calculateSimilarityScore(source, candidate, sourceProfile, candidateProfile);
  return { score: result.score, reasons: result.reasons };
}

export function sortSimilarMovies(source: MovieWithSimilarityRelations, candidates: MovieWithSimilarityRelations[], limit = 10) {
  const sourceProfile = buildSimilarityProfile(source);
  return candidates
    .map((candidate) => {
      const candidateProfile = buildSimilarityProfile(candidate);
      const result = calculateSimilarityScore(source, candidate, sourceProfile, candidateProfile);
      return {
        ...candidate,
        similarityScore: result.score,
        similarityReasons: result.reasons,
        similarityBucket: result.bucket,
      } satisfies SimilarMovieResult;
    })
    .filter((movie) => movie.similarityScore >= 180)
    .sort((a, b) => {
      const scoreDiff = b.similarityScore - a.similarityScore;
      if (scoreDiff) return scoreDiff;
      const ratingDiff = (b.kpRating ?? b.imdbRating ?? 0) - (a.kpRating ?? a.imdbRating ?? 0);
      if (ratingDiff) return ratingDiff;
      return b.year - a.year;
    })
    .slice(0, limit);
}

export function sortAudienceMovies(source: MovieWithSimilarityRelations, candidates: MovieWithSimilarityRelations[], limit = 10) {
  const sourceProfile = buildSimilarityProfile(source);
  return candidates
    .map((candidate) => {
      const candidateProfile = buildSimilarityProfile(candidate);
      const result = calculateSimilarityScore(source, candidate, sourceProfile, candidateProfile);
      return {
        ...candidate,
        similarityScore: result.audienceScore + Math.max(result.score, 0) * 0.25,
        similarityReasons: result.reasons,
        similarityBucket: result.bucket,
      } satisfies SimilarMovieResult;
    })
    .filter((movie) => movie.similarityScore >= 220)
    .sort((a, b) => b.similarityScore - a.similarityScore || (b.popularScore ?? 0) - (a.popularScore ?? 0) || (b.kpRating ?? 0) - (a.kpRating ?? 0))
    .slice(0, limit);
}

export function buildSimilarityCandidateWhere(source: MovieWithSimilarityRelations): Prisma.MovieWhereInput {
  const profile = buildSimilarityProfile(source);
  const hintKeywords = profile.hintKeywords.slice(0, 18);
  const genreIds = source.genres.map((item) => item.genreId);
  const country = source.country?.split(",")[0]?.trim();
  const or: Prisma.MovieWhereInput[] = [
    { type: source.type },
    { year: { gte: source.year - 10, lte: source.year + 10 } },
  ];

  if (genreIds.length) {
    or.push({ genres: { some: { genreId: { in: genreIds } } } });
  }

  if (country) {
    or.push({ country: { contains: country, mode: "insensitive" } });
  }

  for (const keyword of hintKeywords) {
    if (keyword.length < 4) continue;
    or.push({ titleRu: { contains: keyword, mode: "insensitive" } });
    or.push({ titleOriginal: { contains: keyword, mode: "insensitive" } });
    or.push({ description: { contains: keyword, mode: "insensitive" } });
  }

  return { id: { not: source.id }, OR: or };
}

export function buildAudienceCandidateWhere(source: MovieWithSimilarityRelations): Prisma.MovieWhereInput {
  const profile = buildSimilarityProfile(source);
  const genreIds = source.genres.map((item) => item.genreId);
  const profileClusterIds = profile.clusterIds;
  const or: Prisma.MovieWhereInput[] = [
    { type: source.type },
    { year: { gte: source.year - 12, lte: source.year + 12 } },
  ];

  if (genreIds.length) or.push({ genres: { some: { genreId: { in: genreIds } } } });
  for (const keyword of profile.hintKeywords.slice(0, 10)) {
    if (keyword.length >= 4) {
      or.push({ titleRu: { contains: keyword, mode: "insensitive" } });
      or.push({ description: { contains: keyword, mode: "insensitive" } });
    }
  }

  if (intersectCount(profileClusterIds, new Set(["superhero_comic", "superhero_team"])) > 0) {
    or.push({ description: { contains: "комикс", mode: "insensitive" } });
    or.push({ description: { contains: "супергер", mode: "insensitive" } });
  }
  if (profileClusterIds.has("treasure_hunt")) {
    or.push({ description: { contains: "сокровищ", mode: "insensitive" } });
    or.push({ description: { contains: "артефакт", mode: "insensitive" } });
  }

  return { id: { not: source.id }, OR: or };
}

export function similarIntro(movie: MovieWithSimilarityRelations) {
  const profile = buildSimilarityProfile(movie);
  const themes = [...profile.clusterIds].slice(0, 3).join(", ");
  if (themes) {
    return `Если вам понравился «${movie.titleRu}», ниже собраны фильмы и сериалы с похожей франшизой, темой, атмосферой и сюжетным вайбом. Алгоритм учитывает не только жанры, но и смысловой профиль фильма.`;
  }
  const genres = movie.genres.map((item) => item.genre.name.toLowerCase()).slice(0, 3).join(", ");
  const genreText = genres ? `в жанрах ${genres}` : "с похожей атмосферой";
  return `Если вам понравился «${movie.titleRu}», ниже собраны похожие фильмы и сериалы ${genreText}. Подборка строится автоматически по темам, франшизам, описанию, актёрам и рейтингам.`;
}
