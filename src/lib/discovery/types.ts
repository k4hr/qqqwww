import type { ContentType } from "@prisma/client";

export const discoveryMoods = [
  { key: "evening", label: "На вечер", description: "Надёжные хиты и свежие картины без лишнего поиска." },
  { key: "action", label: "Драйв", description: "Боевики, триллеры и фантастика с высоким темпом." },
  { key: "comfort", label: "Лёгкое", description: "Комедии, семейное кино и приключения." },
  { key: "deep", label: "Серьёзное", description: "Драмы, детективы и криминальные истории." },
  { key: "new", label: "Новое", description: "Свежие добавления и релизы последних лет." },
] as const;

export const discoveryMoodOptions = [
  { key: "light", label: "Лёгкое" },
  { key: "tense", label: "Напряжённое" },
  { key: "dark", label: "Мрачное" },
  { key: "heartfelt", label: "Душевное" },
  { key: "adventure", label: "Приключенческое" },
  { key: "fantastic", label: "Фантастическое" },
  { key: "unexpected", label: "Неожиданное" },
] as const;

export const discoveryTypeOptions = [
  { key: "ANY", label: "Любой" },
  { key: "MOVIE", label: "Фильм" },
  { key: "SERIES", label: "Сериал" },
  { key: "CARTOON", label: "Мультфильм" },
  { key: "ANIME", label: "Аниме" },
] as const;

export const discoveryRuntimeOptions = [
  { key: "ANY", label: "Любая" },
  { key: "UNDER_90", label: "До 90 минут" },
  { key: "UNDER_120", label: "До 120 минут" },
  { key: "OVER_120", label: "Более 120 минут" },
] as const;

export const discoveryPeriodOptions = [
  { key: "ANY", label: "Любой" },
  { key: "NEW", label: "Новинки" },
  { key: "2020S", label: "2020-е" },
  { key: "2010S", label: "2010-е" },
  { key: "CLASSIC", label: "Классика" },
] as const;

export type DiscoveryPresetMood = typeof discoveryMoods[number]["key"];
export type DiscoveryDetailedMood = typeof discoveryMoodOptions[number]["key"];
export type DiscoveryMood = DiscoveryPresetMood | DiscoveryDetailedMood;
export type DiscoveryType = "ANY" | ContentType;
export type DiscoveryRuntime = typeof discoveryRuntimeOptions[number]["key"];
export type DiscoveryPeriod = typeof discoveryPeriodOptions[number]["key"];

export type DiscoveryFilters = {
  type: DiscoveryType;
  mood: DiscoveryMood;
  runtime: DiscoveryRuntime;
  period: DiscoveryPeriod;
  highRating?: boolean;
  popular?: boolean;
  onlyNew?: boolean;
  randomGood?: boolean;
};

export type MatchPreferences = {
  version: 1;
  liked: string[];
  disliked: string[];
  skipped: string[];
  genreWeights: Record<string, number>;
  typeWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  countryWeights: Record<string, number>;
  runtimeBuckets: Record<string, number>;
  runtimePreference?: DiscoveryRuntime;
  lastUpdatedAt: number;
};

export type MatchHistoryEvent = {
  movieId: string;
  action: "LIKE" | "DISLIKE" | "SKIP";
  createdAt: number;
};

export type DiscoveryMovie = {
  id: string;
  slug: string;
  titleRu: string;
  year: number;
  type: ContentType;
  posterUrl: string | null;
  backdropUrl: string;
  quality: string;
  duration: number | null;
  kpRating: number | null;
  imdbRating: number | null;
  description: string;
  country: string | null;
  genres: string[];
  cast: string[];
  homeScore: number;
  trendScore: number;
  explanation?: string;
};

export const defaultDiscoveryFilters: DiscoveryFilters = {
  type: "ANY",
  mood: "evening",
  runtime: "ANY",
  period: "ANY",
  highRating: false,
  popular: false,
  onlyNew: false,
  randomGood: false,
};

export function emptyMatchPreferences(): MatchPreferences {
  return {
    version: 1,
    liked: [],
    disliked: [],
    skipped: [],
    genreWeights: {},
    typeWeights: {},
    decadeWeights: {},
    countryWeights: {},
    runtimeBuckets: {},
    lastUpdatedAt: Date.now(),
  };
}

export function normalizeDiscoveryMood(value: unknown): DiscoveryMood {
  const valid = [...discoveryMoods, ...discoveryMoodOptions].some((mood) => mood.key === value);
  return valid ? value as DiscoveryMood : "evening";
}

export function normalizeDiscoveryType(value: unknown): DiscoveryType {
  return discoveryTypeOptions.some((option) => option.key === value) ? value as DiscoveryType : "ANY";
}

export function normalizeDiscoveryRuntime(value: unknown): DiscoveryRuntime {
  return discoveryRuntimeOptions.some((option) => option.key === value) ? value as DiscoveryRuntime : "ANY";
}

export function normalizeDiscoveryPeriod(value: unknown): DiscoveryPeriod {
  return discoveryPeriodOptions.some((option) => option.key === value) ? value as DiscoveryPeriod : "ANY";
}
