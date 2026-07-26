import type { ContentType } from "@prisma/client";
import type { DiscoveryFilters, MatchPreferences } from "@/lib/discovery/types";

export type MatchRankableMovie = {
  id: string;
  titleRu: string;
  year: number;
  type: ContentType;
  genres: string[];
  cast?: string[];
  director?: string | null;
  country?: unknown;
  duration?: number | null;
};

export type DiversityReason = "franchise" | "genre" | "decade" | "type" | "person" | "director";

export type DiversityDiagnostic = {
  movieId: string;
  status: "selected" | "deferred" | "rejected";
  stage: 1 | 2 | 3;
  reasons: DiversityReason[];
};

type DiversityOptions = {
  maxStage?: 1 | 2 | 3;
  debug?: boolean;
};

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMovieCountries(value: unknown): string[] {
  let source: unknown = value;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        source = JSON.parse(trimmed) as unknown;
      } catch {
        source = trimmed;
      }
    }
  }

  const values = Array.isArray(source)
    ? source
    : typeof source === "string"
      ? source.split(/[,;/|]+/)
      : [];

  return Array.from(new Set(
    values
      .filter((item): item is string => typeof item === "string")
      .map(normalizeText)
      .filter(Boolean),
  ));
}

export function countryPreferenceScore(weights: Record<string, number> | undefined, country: unknown) {
  if (!weights) return 0;
  const normalizedWeights = new Map(
    Object.entries(weights).map(([key, value]) => [normalizeText(key), Number.isFinite(value) ? value : 0]),
  );
  const scores = normalizeMovieCountries(country)
    .map((item) => normalizedWeights.get(item) ?? 0)
    .filter((value) => value !== 0);
  if (!scores.length) return 0;
  const positives = scores.filter((value) => value > 0);
  const strongest = positives.length ? Math.max(...positives) : Math.min(...scores);
  return Math.max(-4, Math.min(4, strongest));
}

function runtimeKey(duration?: number | null) {
  if (!duration) return "UNKNOWN";
  if (duration <= 90) return "UNDER_90";
  if (duration <= 120) return "UNDER_120";
  return "OVER_120";
}

function decadeKey(year: number) {
  return `${Math.floor(year / 10) * 10}`;
}

function franchiseKey(title: string) {
  return normalizeText(title)
    .replace(/\b(?:часть|сезон|глава|эпизод|part|chapter|season)\s*\d+\b/giu, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-zа-я]+/giu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

export function matchPreferenceScore(movie: MatchRankableMovie, preferences: Partial<MatchPreferences>) {
  const genreScores = movie.genres
    .map((genre) => preferences.genreWeights?.[genre] ?? 0)
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, 3);
  return genreScores.reduce((sum, value) => sum + value, 0)
    + (preferences.typeWeights?.[movie.type] ?? 0) * 1.3
    + (preferences.decadeWeights?.[decadeKey(movie.year)] ?? 0)
    + countryPreferenceScore(preferences.countryWeights, movie.country) * 0.6
    + (preferences.runtimeBuckets?.[runtimeKey(movie.duration)] ?? 0) * 0.8;
}

export function rankMatchCandidatesByPreferences<T extends MatchRankableMovie>(movies: T[], preferences: Partial<MatchPreferences>) {
  return movies
    .map((movie, index) => ({ movie, index, score: matchPreferenceScore(movie, preferences) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ movie }) => movie);
}

function addCount(map: Map<string, number>, key: string) {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

export function rerankMatchCandidatesWithDiversity<T extends MatchRankableMovie>(
  rows: T[],
  target: number,
  filters: Pick<DiscoveryFilters, "type">,
  options: DiversityOptions = {},
) {
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const diagnostics: DiversityDiagnostic[] = [];
  const franchiseCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const personCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const strictCaps = {
    franchise: 1,
    genre: Math.max(3, Math.ceil(target * 0.38)),
    decade: Math.max(3, Math.ceil(target * 0.38)),
    type: Math.max(4, Math.ceil(target * 0.62)),
    person: 1,
    director: 1,
  };
  const stages = [
    strictCaps,
    { ...strictCaps, genre: strictCaps.genre + 1, decade: strictCaps.decade + 1 },
    { ...strictCaps, franchise: 2, genre: strictCaps.genre + 1, decade: strictCaps.decade + 1, person: 2, director: 2 },
  ] as const;
  const maxStage = options.maxStage ?? 3;

  const rejectionReasons = (movie: T, caps: typeof stages[number]) => {
    const reasons: DiversityReason[] = [];
    const franchise = franchiseKey(movie.titleRu);
    const decade = decadeKey(movie.year);
    const people = Array.from(new Set((movie.cast ?? []).map(normalizeText).filter(Boolean))).slice(0, 4);
    const director = normalizeText(movie.director ?? "");
    if (franchise && (franchiseCounts.get(franchise) ?? 0) >= caps.franchise) reasons.push("franchise");
    if (movie.genres.some((genre) => (genreCounts.get(genre) ?? 0) >= caps.genre)) reasons.push("genre");
    if ((decadeCounts.get(decade) ?? 0) >= caps.decade) reasons.push("decade");
    if (filters.type === "ANY" && (typeCounts.get(movie.type) ?? 0) >= caps.type) reasons.push("type");
    if (people.some((person) => (personCounts.get(person) ?? 0) >= caps.person)) reasons.push("person");
    if (director && (directorCounts.get(director) ?? 0) >= caps.director) reasons.push("director");
    return reasons;
  };

  const select = (movie: T) => {
    selected.push(movie);
    selectedIds.add(movie.id);
    addCount(franchiseCounts, franchiseKey(movie.titleRu));
    movie.genres.forEach((genre) => addCount(genreCounts, genre));
    addCount(decadeCounts, decadeKey(movie.year));
    addCount(typeCounts, movie.type);
    Array.from(new Set((movie.cast ?? []).map(normalizeText).filter(Boolean))).slice(0, 4).forEach((person) => addCount(personCounts, person));
    addCount(directorCounts, normalizeText(movie.director ?? ""));
  };

  for (let stageIndex = 0; stageIndex < maxStage && selected.length < target; stageIndex += 1) {
    const stage = (stageIndex + 1) as 1 | 2 | 3;
    for (const movie of rows) {
      if (selected.length >= target) break;
      if (selectedIds.has(movie.id)) continue;
      const reasons = rejectionReasons(movie, stages[stageIndex]);
      if (reasons.length) {
        if (options.debug) diagnostics.push({ movieId: movie.id, status: stage === maxStage ? "rejected" : "deferred", stage, reasons });
        continue;
      }
      select(movie);
      if (options.debug) diagnostics.push({ movieId: movie.id, status: "selected", stage, reasons: [] });
    }
  }

  return { selected, diagnostics, rejected: rows.filter((movie) => !selectedIds.has(movie.id)) };
}

export function personalizeInitialMatchQueue<T extends MatchRankableMovie>(
  movies: T[],
  preferences: Partial<MatchPreferences>,
  excludedIds: Iterable<string>,
  filters: Pick<DiscoveryFilters, "type">,
  preserveActiveId?: string | null,
) {
  const excluded = new Set(excludedIds);
  const available = movies.filter((movie) => !excluded.has(movie.id));
  const ranked = rankMatchCandidatesByPreferences(available, preferences);
  const active = preserveActiveId ? available.find((movie) => movie.id === preserveActiveId) : undefined;
  const ordered = active ? [active, ...ranked.filter((movie) => movie.id !== active.id)] : ranked;
  return rerankMatchCandidatesWithDiversity(ordered, ordered.length, filters).selected;
}

export function restoreMatchQueue<T extends { id: string }>(movie: T, queue: T[]) {
  return queue.some((item) => item.id === movie.id) ? queue : [movie, ...queue];
}

export function matchCandidatePassesFilters(movie: Pick<MatchRankableMovie, "type" | "year" | "duration">, filters: DiscoveryFilters) {
  const currentYear = new Date().getFullYear();
  if (filters.type !== "ANY" && movie.type !== filters.type) return false;
  if (filters.runtime === "UNDER_90" && (!movie.duration || movie.duration > 90)) return false;
  if (filters.runtime === "UNDER_120" && (!movie.duration || movie.duration > 120)) return false;
  if (filters.runtime === "OVER_120" && (!movie.duration || movie.duration <= 120)) return false;
  if ((filters.onlyNew || filters.period === "NEW") && movie.year < currentYear - 2) return false;
  if (filters.period === "2020S" && (movie.year < 2020 || movie.year > 2029)) return false;
  if (filters.period === "2010S" && (movie.year < 2010 || movie.year > 2019)) return false;
  if (filters.period === "CLASSIC" && movie.year > 1999) return false;
  return true;
}
