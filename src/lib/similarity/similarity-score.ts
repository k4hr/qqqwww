import type { ContentType } from "@prisma/client";
import { CLUSTER_BY_ID } from "./similarity-clusters";
import { buildSimilarityProfile, type MovieWithSimilarityRelations, type SimilarityProfile } from "./similarity-profile";

export const SIMILARITY_ALGORITHM_VERSION = 2;

export type SimilarityBucket = "franchise" | "external_recommendation" | "external_similar" | "external" | "theme" | "people" | "metadata" | "cross_type_atmosphere" | "weak";

export type SimilarityScoreResult = {
  score: number;
  audienceScore: number;
  reasons: string[];
  bucket: SimilarityBucket;
  strongSignals: number;
  penalties: string[];
  rejectionReason?: string;
  components: {
    franchiseScore: number;
    externalScore: number;
    plotScore: number;
    themeScore: number;
    toneScore: number;
    settingScore: number;
    peopleScore: number;
    metadataScore: number;
    qualityScore: number;
    contradictionPenalty: number;
  };
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
  if ((sourceType === "MOVIE" && candidateType === "SERIES") || (sourceType === "SERIES" && candidateType === "MOVIE")) return -240;
  return -480;
}

function countryOverlap(source: SimilarityProfile, candidate: SimilarityProfile) {
  return intersection(source.countryNames, candidate.countryNames).length > 0;
}

function contradictionPenalties(source: SimilarityProfile, candidate: SimilarityProfile) {
  const penalties: string[] = [];
  if (source.isAnimated !== candidate.isAnimated) penalties.push("animation_live_action_mismatch");
  if (source.isDocumentary !== candidate.isDocumentary) penalties.push("documentary_fiction_mismatch");
  if ((source.isFamilyOrKids && candidate.isHorror) || (source.isHorror && candidate.isFamilyOrKids)) penalties.push("family_horror_mismatch");
  return penalties;
}

function sameBaseTitle(source: SimilarityProfile, candidate: SimilarityProfile) {
  return Boolean(source.baseTitle && candidate.baseTitle && source.baseTitle === candidate.baseTitle);
}

export function calculateSimilarityScore(
  source: MovieWithSimilarityRelations,
  candidate: MovieWithSimilarityRelations,
  sourceProfile = buildSimilarityProfile(source),
  candidateProfile = buildSimilarityProfile(candidate),
): SimilarityScoreResult {
  let score = 0;
  let audienceScore = 0;
  let strongSignals = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];
  const components: SimilarityScoreResult["components"] = {
    franchiseScore: 0,
    externalScore: 0,
    plotScore: 0,
    themeScore: 0,
    toneScore: 0,
    settingScore: 0,
    peopleScore: 0,
    metadataScore: 0,
    qualityScore: 0,
    contradictionPenalty: 0,
  };

  const sameFranchises = intersection(sourceProfile.franchiseIds, candidateProfile.franchiseIds);
  for (const id of sameFranchises) {
    const cluster = CLUSTER_BY_ID.get(id);
    const value = cluster?.weight ?? 1200;
    score += value;
    components.franchiseScore += value;
    audienceScore += 600;
    if (cluster) reasons.push(`та же франшиза: ${cluster.label}`);
  }
  if (sameFranchises.length) strongSignals += 2;

  if (sameBaseTitle(sourceProfile, candidateProfile)) {
    score += 900;
    components.franchiseScore += 900;
    audienceScore += 450;
    strongSignals += 2;
    reasons.push("та же серия фильмов или близкая часть франшизы");
  }

  const sameClusters = intersection(sourceProfile.clusterIds, candidateProfile.clusterIds)
    .filter((id) => !sourceProfile.franchiseIds.has(id));
  for (const id of sameClusters) {
    const cluster = CLUSTER_BY_ID.get(id);
    const weight = cluster?.weight ?? 450;
    score += weight;
    components.themeScore += weight;
    audienceScore += Math.floor(weight * 0.55);
    if (cluster) reasons.push(`общая тема: ${cluster.label}`);
  }
  if (sameClusters.some((id) => (CLUSTER_BY_ID.get(id)?.weight ?? 0) >= 450)) strongSignals += 1;

  const sameSources = intersection(sourceProfile.sourceTypeIds, candidateProfile.sourceTypeIds);
  if (sameSources.length) {
    score += 350;
    components.plotScore += 350;
    audienceScore += 250;
    strongSignals += 1;
    reasons.push("похожий источник сюжета");
  }

  const sameTags = intersection(sourceProfile.tagNames, candidateProfile.tagNames);
  if (sameTags.length >= 2) {
    const value = Math.min(sameTags.length * 120, 360);
    score += value;
    components.themeScore += value;
    audienceScore += Math.floor(value * 0.55);
    strongSignals += 1;
    reasons.push("похожие теги и темы");
  }

  const sameGenres = intersection(sourceProfile.genreNames, candidateProfile.genreNames);
  if (sameGenres.length) {
    const value = Math.min(sameGenres.length * 80, 180);
    score += value;
    components.metadataScore += value;
    audienceScore += Math.min(sameGenres.length * 140, 340);
    reasons.push(`общие жанры: ${sameGenres.slice(0, 3).join(", ")}`);
  }

  const sameSpecificGenres = intersection(sourceProfile.specificGenreNames, candidateProfile.specificGenreNames);
  if (sameSpecificGenres.length >= 2) {
    score += 130;
    components.metadataScore += 130;
    strongSignals += 1;
  }

  const sameActors = intersection(sourceProfile.castNames, candidateProfile.castNames);
  if (sameActors.length) {
    const value = Math.min(sameActors.length * 90, 260);
    score += value;
    components.peopleScore += value;
    audienceScore += value + 80;
    if (sameActors.length >= 2) strongSignals += 1;
    reasons.push("есть общие актёры");
  }

  if (sourceProfile.directorName && sourceProfile.directorName === candidateProfile.directorName) {
    score += 220;
    components.peopleScore += 220;
    audienceScore += 260;
    strongSignals += 1;
    reasons.push("тот же режиссёр");
  }

  const candidateRating = rating(candidate);
  if (candidateRating >= 7.5) {
    score += 50;
    components.qualityScore += 50;
    audienceScore += 80;
  } else if (candidateRating < 5.5 && candidateRating > 0) {
    score -= 80;
    components.qualityScore -= 80;
    audienceScore -= 50;
  }

  const candidateVotes = votes(candidate);
  if (candidateVotes >= 100000) audienceScore += 120;
  else if (candidateVotes >= 20000) audienceScore += 70;

  const yearDiff = Math.abs(source.year - candidate.year);
  if (yearDiff <= 3) {
    score += 40;
    components.metadataScore += 40;
    audienceScore += 60;
  } else if (yearDiff <= 10) {
    score += 20;
    components.metadataScore += 20;
    audienceScore += 35;
  }

  if (countryOverlap(sourceProfile, candidateProfile)) {
    score += 35;
    components.settingScore += 35;
  }

  const mismatchPenalty = typePenalty(source.type, candidate.type);
  score += mismatchPenalty;
  audienceScore += Math.floor(mismatchPenalty * 0.6);
  components.contradictionPenalty += mismatchPenalty;
  if (mismatchPenalty < -400) penalties.push("type_mismatch");

  const contradictions = contradictionPenalties(sourceProfile, candidateProfile);
  if (contradictions.length) {
    const penalty = contradictions.length * -260;
    score += penalty;
    audienceScore += Math.floor(penalty * 0.65);
    components.contradictionPenalty += penalty;
    penalties.push(...contradictions);
  }

  if (sourceProfile.hasStrongIdentity && !sameFranchises.length && !sameClusters.length && !sameTags.length) {
    score -= 520;
    components.contradictionPenalty -= 520;
    penalties.push("missing_source_identity");
  }

  if (sourceProfile.franchiseIds.size > 0 && !sameFranchises.length && sameGenres.length && !sameClusters.length) {
    score -= 420;
    components.contradictionPenalty -= 420;
    penalties.push("broad_genre_only");
  }

  if (!strongSignals && sameGenres.length && yearDiff <= 10) penalties.push("weak_metadata_only");
  if (!reasons.length) reasons.push("схожая аудитория и жанровая близость");

  let bucket: SimilarityBucket = "weak";
  if (sameFranchises.length || sameBaseTitle(sourceProfile, candidateProfile)) bucket = "franchise";
  else if (sameClusters.length || sameTags.length >= 2) bucket = "theme";
  else if (sameActors.length >= 2 || (sourceProfile.directorName && sourceProfile.directorName === candidateProfile.directorName)) bucket = "people";
  else if (source.type !== candidate.type && strongSignals > 0) bucket = "cross_type_atmosphere";
  else if (sameSpecificGenres.length >= 2 && countryOverlap(sourceProfile, candidateProfile)) bucket = "metadata";

  let rejectionReason: string | undefined;
  if (source.id === candidate.id) rejectionReason = "same_movie";
  else if (source.type !== candidate.type && bucket !== "cross_type_atmosphere") rejectionReason = "type_mismatch";
  else if (!strongSignals && score < 360) rejectionReason = "no_strong_signal";
  else if (penalties.includes("broad_genre_only") || penalties.includes("weak_metadata_only")) rejectionReason = "broad_genre_only";
  else if (components.contradictionPenalty <= -450) rejectionReason = "contradiction";

  return {
    score: Math.round(score),
    audienceScore: Math.round(audienceScore),
    reasons: Array.from(new Set(reasons)).slice(0, 6),
    bucket,
    strongSignals,
    penalties: Array.from(new Set(penalties)),
    rejectionReason,
    components,
  };
}

export function isStrictSimilarityMatch(result: SimilarityScoreResult, minScore = 180) {
  if (result.score < minScore) return false;
  if (result.rejectionReason) return false;
  if (result.bucket === "franchise" || result.bucket === "theme") return result.strongSignals >= 1;
  if (result.bucket === "external_recommendation") return result.score >= Math.max(minScore, 520) && result.strongSignals >= 1 && result.components.contradictionPenalty > -360;
  if (result.bucket === "external_similar" || result.bucket === "external") return result.score >= Math.max(minScore, 560) && result.strongSignals >= 1 && result.components.contradictionPenalty > -300;
  if (result.bucket === "people") return result.score >= Math.max(minScore, 260) && result.strongSignals >= 1;
  if (result.bucket === "metadata") return result.score >= Math.max(minScore, 320) && result.strongSignals >= 1;
  if (result.bucket === "cross_type_atmosphere") return result.score >= 520 && result.strongSignals >= 2;
  return false;
}
