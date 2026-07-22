"use client";

import {
  emptyMatchPreferences,
  type DiscoveryMovie,
  type MatchHistoryEvent,
  type MatchPreferences,
} from "@/lib/discovery/types";

export const MATCH_PREFERENCES_KEY = "redfilm:match:preferences:v1";
export const MATCH_HISTORY_KEY = "redfilm:match:history:v1";

const MAX_LIKED = 80;
const MAX_DISLIKED = 120;
const MAX_SKIPPED = 160;
const MAX_HISTORY = 220;

function stringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))).slice(-limit);
}

function weights(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, weight]) => key.length <= 80 && typeof weight === "number" && Number.isFinite(weight))
      .slice(-60)
      .map(([key, weight]) => [key, Math.max(-12, Math.min(24, weight as number))]),
  );
}

export function cloneMatchPreferences(value: MatchPreferences): MatchPreferences {
  return {
    ...value,
    liked: [...value.liked],
    disliked: [...value.disliked],
    skipped: [...value.skipped],
    genreWeights: { ...value.genreWeights },
    typeWeights: { ...value.typeWeights },
    decadeWeights: { ...value.decadeWeights },
    countryWeights: { ...value.countryWeights },
    runtimeBuckets: { ...value.runtimeBuckets },
  };
}

export function readMatchPreferences(): MatchPreferences {
  const fallback = emptyMatchPreferences();
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MATCH_PREFERENCES_KEY) ?? "null") as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return {
      version: 1,
      liked: stringArray(parsed.liked, MAX_LIKED),
      disliked: stringArray(parsed.disliked, MAX_DISLIKED),
      skipped: stringArray(parsed.skipped, MAX_SKIPPED),
      genreWeights: weights(parsed.genreWeights),
      typeWeights: weights(parsed.typeWeights),
      decadeWeights: weights(parsed.decadeWeights),
      countryWeights: weights(parsed.countryWeights),
      runtimeBuckets: weights(parsed.runtimeBuckets),
      runtimePreference: typeof parsed.runtimePreference === "string" ? parsed.runtimePreference as MatchPreferences["runtimePreference"] : undefined,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "number" && Number.isFinite(parsed.lastUpdatedAt) ? parsed.lastUpdatedAt : Date.now(),
    };
  } catch {
    return fallback;
  }
}

export function readMatchHistory(): MatchHistoryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MATCH_HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): MatchHistoryEvent | null => {
        if (typeof item === "string") return { movieId: item, action: "SKIP", createdAt: 0 };
        if (!item || typeof item !== "object") return null;
        const value = item as Partial<MatchHistoryEvent>;
        if (typeof value.movieId !== "string" || !["LIKE", "DISLIKE", "SKIP"].includes(value.action ?? "")) return null;
        return { movieId: value.movieId, action: value.action!, createdAt: typeof value.createdAt === "number" ? value.createdAt : 0 };
      })
      .filter((item): item is MatchHistoryEvent => Boolean(item))
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

export function writeMatchState(preferences: MatchPreferences, history: MatchHistoryEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MATCH_PREFERENCES_KEY, JSON.stringify(preferences));
    window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // Local recommendations remain optional when browser storage is unavailable.
  }
}

function boundedWeight(record: Record<string, number>, key: string | null | undefined, delta: number) {
  if (!key) return;
  const next = Math.max(-12, Math.min(24, (record[key] ?? 0) + delta));
  if (Math.abs(next) < 0.01) delete record[key];
  else record[key] = Number(next.toFixed(2));
}

function runtimeBucket(duration: number | null) {
  if (!duration) return "UNKNOWN";
  if (duration <= 90) return "UNDER_90";
  if (duration <= 120) return "UNDER_120";
  return "OVER_120";
}

export function applyMatchDecision(current: MatchPreferences, movie: DiscoveryMovie, action: MatchHistoryEvent["action"]) {
  const next = cloneMatchPreferences(current);
  next.liked = next.liked.filter((id) => id !== movie.id);
  next.disliked = next.disliked.filter((id) => id !== movie.id);
  next.skipped = next.skipped.filter((id) => id !== movie.id);

  if (action === "LIKE") next.liked = [...next.liked, movie.id].slice(-MAX_LIKED);
  if (action === "DISLIKE") next.disliked = [...next.disliked, movie.id].slice(-MAX_DISLIKED);
  if (action === "SKIP") next.skipped = [...next.skipped, movie.id].slice(-MAX_SKIPPED);

  const factor = action === "LIKE" ? 1 : action === "DISLIKE" ? -0.28 : 0.03;
  for (const genre of movie.genres) boundedWeight(next.genreWeights, genre, 1.4 * factor);
  boundedWeight(next.typeWeights, movie.type, 1.8 * factor);
  boundedWeight(next.decadeWeights, `${Math.floor(movie.year / 10) * 10}`, 1.1 * factor);
  for (const country of (movie.country ?? "").split(/[,;/|]+/).map((item) => item.trim()).filter(Boolean).slice(0, 3)) {
    boundedWeight(next.countryWeights, country, 0.7 * factor);
  }
  boundedWeight(next.runtimeBuckets, runtimeBucket(movie.duration), 0.8 * factor);
  next.lastUpdatedAt = Date.now();
  return next;
}

export function resetMatchStorage() {
  const preferences = emptyMatchPreferences();
  writeMatchState(preferences, []);
  return preferences;
}
