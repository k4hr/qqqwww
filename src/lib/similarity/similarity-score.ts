import type { ContentType } from "@prisma/client";
import { CLUSTER_BY_ID } from "./similarity-clusters";
import { buildSimilarityProfile, type MovieWithSimilarityRelations, type SimilarityProfile } from "./similarity-profile";

export type SimilarityScoreResult = {
  score: number;
  audienceScore: number;
  reasons: string[];
  bucket: "franchise" | "theme" | "audience" | "weak";
};

function intersection<T>(a: Set<T>, b: Set<T>) {
  const result: T[] = [];
  for (const item of a) if (b.has(item)) result.push(item);
  return result;
}

function rating(movie: MovieWithSimilarityRelations) {
  return movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating ?? 0;
}

function votes(movie: MovieWithSimilarityRelations) {
  return (movie.kpVotes ?? 0) + (movie.imdbVotes ?? 0) + (movie.tmdbVotes ?? 0);
}

function typePenalty(sourceType: ContentType, candidateType: ContentType) {
  if (sourceType === candidateType) return 0;
  if ((sourceType === "CARTOON" || sourceType === "ANIME") || (candidateType === "CARTOON" || candidateType === "ANIME")) return -900;
  if ((sourceType === "MOVIE" && candidateType === "SERIES") || (sourceType === "SERIES" && candidateType === "MOVIE")) return -220;
  return -450;
}

export function calculateSimilarityScore(
  source: MovieWithSimilarityRelations,
  candidate: MovieWithSimilarityRelations,
  sourceProfile = buildSimilarityProfile(source),
  candidateProfile = buildSimilarityProfile(candidate),
): SimilarityScoreResult {
  let score = 0;
  let audienceScore = 0;
  const reasons: string[] = [];

  const sameFranchises = intersection(sourceProfile.franchiseIds, candidateProfile.franchiseIds);
  if (sameFranchises.length) {
    for (const id of sameFranchises) {
      const cluster = CLUSTER_BY_ID.get(id);
      score += cluster?.weight ?? 1200;
      audienceScore += 600;
      if (cluster) reasons.push(`та же франшиза: ${cluster.label}`);
    }
  }

  const sameClusters = intersection(sourceProfile.clusterIds, candidateProfile.clusterIds)
    .filter((id) => !sourceProfile.franchiseIds.has(id));
  if (sameClusters.length) {
    for (const id of sameClusters) {
      const cluster = CLUSTER_BY_ID.get(id);
      const weight = cluster?.weight ?? 450;
      score += weight;
      audienceScore += Math.floor(weight * 0.55);
      if (cluster) reasons.push(`общая тема: ${cluster.label}`);
    }
  }

  const sameSources = intersection(sourceProfile.sourceTypeIds, candidateProfile.sourceTypeIds);
  if (sameSources.length) {
    score += 350;
    audienceScore += 250;
    reasons.push("похожий источник сюжета");
  }

  if (sourceProfile.baseTitle && candidateProfile.baseTitle && sourceProfile.baseTitle === candidateProfile.baseTitle) {
    score += 900;
    audienceScore += 450;
    reasons.push("та же серия фильмов");
  }

  const sameGenres = intersection(sourceProfile.genreNames, candidateProfile.genreNames);
  if (sameGenres.length) {
    score += Math.min(sameGenres.length * 110, 260);
    audienceScore += Math.min(sameGenres.length * 140, 340);
    reasons.push(`общие жанры: ${sameGenres.slice(0, 3).join(", ")}`);
  }

  const sameActors = intersection(sourceProfile.castNames, candidateProfile.castNames);
  if (sameActors.length) {
    const actorBonus = Math.min(sameActors.length * 90, 260);
    score += actorBonus;
    audienceScore += actorBonus + 80;
    reasons.push("есть общие актёры");
  }

  if (source.director && candidate.director && source.director.toLowerCase() === candidate.director.toLowerCase()) {
    score += 220;
    audienceScore += 260;
    reasons.push("тот же режиссёр");
  }

  const candidateRating = rating(candidate);
  if (candidateRating >= 7.5) {
    score += 50;
    audienceScore += 80;
  } else if (candidateRating < 5.5 && candidateRating > 0) {
    score -= 80;
    audienceScore -= 50;
  }

  const candidateVotes = votes(candidate);
  if (candidateVotes >= 100000) audienceScore += 120;
  else if (candidateVotes >= 20000) audienceScore += 70;

  const yearDiff = Math.abs(source.year - candidate.year);
  if (yearDiff <= 3) {
    score += 40;
    audienceScore += 60;
  } else if (yearDiff <= 10) {
    score += 20;
    audienceScore += 35;
  }

  const mismatchPenalty = typePenalty(source.type, candidate.type);
  score += mismatchPenalty;
  audienceScore += Math.floor(mismatchPenalty * 0.6);
  if (mismatchPenalty < -400) reasons.push("штраф за другой тип контента");

  if (sourceProfile.hasStrongIdentity && !sameFranchises.length && !sameClusters.length) {
    score -= 520;
    reasons.push("нет главной смысловой связи");
  }

  if (sourceProfile.franchiseIds.size > 0 && !sameFranchises.length && sameGenres.length && !sameClusters.length) {
    score -= 420;
    reasons.push("только общий жанр без франшизы");
  }

  if (!reasons.length) reasons.push("схожая аудитория и жанровая близость");

  let bucket: SimilarityScoreResult["bucket"] = "weak";
  if (sameFranchises.length) bucket = "franchise";
  else if (sameClusters.length) bucket = "theme";
  else if (audienceScore >= 300) bucket = "audience";

  return {
    score: Math.round(score),
    audienceScore: Math.round(audienceScore),
    reasons: Array.from(new Set(reasons)).slice(0, 6),
    bucket,
  };
}
