import { SIMILARITY_ALGORITHM_VERSION, type SimilarityBucket, type SimilarityScoreResult } from "@/lib/similarity/similarity-score";

export type SimilarityReasonPayload = {
  version: 2;
  reasons: string[];
  sources: string[];
  signals: {
    tmdbRecommendation: boolean;
    tmdbSimilar: boolean;
    sameCollection: boolean;
    sameFranchise: boolean;
    keywordOverlap: number;
    specificGenreOverlap: number;
  };
  components: Record<string, number>;
  penalties: {
    typeMismatch: number;
    audienceMismatch: number;
    broadGenreOnly: number;
    labels: string[];
  };
  bucket: SimilarityBucket | string;
  algorithmVersion: number;
};

export type ParsedSimilarityReasons = {
  reasons: string[];
  sources: string[];
  payload: SimilarityReasonPayload | null;
  algorithmVersion: number;
  isLegacy: boolean;
};

const FALLBACK_REASON = "смысловая похожесть рассчитана REDFILM";

function publicReasons(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6);
}

function publicSources(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 12);
}

export function buildSimilarityReasonsJson(result: SimilarityScoreResult, sources: string[]): string {
  const uniqueSources = Array.from(new Set(sources));
  const payload: SimilarityReasonPayload = {
    version: 2,
    reasons: result.reasons.length ? result.reasons.slice(0, 6) : [FALLBACK_REASON],
    sources: uniqueSources,
    signals: {
      tmdbRecommendation: uniqueSources.includes("TMDB_RECOMMENDATIONS"),
      tmdbSimilar: uniqueSources.includes("TMDB_SIMILAR"),
      sameCollection: uniqueSources.includes("TMDB_COLLECTION") || uniqueSources.includes("SAME_COLLECTION"),
      sameFranchise: result.bucket === "franchise",
      keywordOverlap: Math.round(result.components.themeScore / 120),
      specificGenreOverlap: Math.round(result.components.metadataScore / 130),
    },
    components: {
      franchise: result.components.franchiseScore,
      external: result.components.externalScore,
      plot: result.components.plotScore,
      theme: result.components.themeScore,
      tone: result.components.toneScore,
      setting: result.components.settingScore,
      people: result.components.peopleScore,
      metadata: result.components.metadataScore,
      quality: result.components.qualityScore,
      contradiction: result.components.contradictionPenalty,
    },
    penalties: {
      typeMismatch: result.penalties.includes("type_mismatch") ? 1 : 0,
      audienceMismatch: result.penalties.some((item) => item.includes("family") || item.includes("audience")) ? 1 : 0,
      broadGenreOnly: result.penalties.includes("broad_genre_only") || result.penalties.includes("weak_metadata_only") ? 1 : 0,
      labels: result.penalties,
    },
    bucket: result.bucket,
    algorithmVersion: SIMILARITY_ALGORITHM_VERSION,
  };

  return JSON.stringify(payload);
}

export function parseSimilarityReasonsJson(value: string | null | undefined): ParsedSimilarityReasons {
  if (!value) {
    return { reasons: [FALLBACK_REASON], sources: [], payload: null, algorithmVersion: 0, isLegacy: true };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const reasons = publicReasons(parsed);
      return { reasons: reasons.length ? reasons : [FALLBACK_REASON], sources: [], payload: null, algorithmVersion: 0, isLegacy: true };
    }

    if (parsed && typeof parsed === "object") {
      const object = parsed as Partial<SimilarityReasonPayload>;
      const reasons = publicReasons(object.reasons);
      const sources = publicSources(object.sources);
      const algorithmVersion = typeof object.algorithmVersion === "number" ? object.algorithmVersion : typeof object.version === "number" ? object.version : 0;
      return {
        reasons: reasons.length ? reasons : [FALLBACK_REASON],
        sources,
        payload: object.version === 2 ? object as SimilarityReasonPayload : null,
        algorithmVersion,
        isLegacy: false,
      };
    }
  } catch {
    // Invalid legacy data should not break public pages.
  }

  return { reasons: [FALLBACK_REASON], sources: [], payload: null, algorithmVersion: 0, isLegacy: true };
}
