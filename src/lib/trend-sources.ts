import { ContentType } from "@prisma/client";
import { slugify } from "@/lib/slug";

export type TrendSourceRule = {
  source: "TMDB_COLLECTION" | "TMDB_COMPANY" | "TMDB_NETWORK" | "TMDB_KEYWORD" | "TMDB_PERSON";
  category: string;
  entity: "company" | "keyword" | "person" | "collection" | "network";
  query?: string;
  entityId?: number;
  type: ContentType;
  discoverParam?: "with_companies" | "with_keywords" | "with_people" | "with_networks";
  weight: number;
};

const movieKeywords = [
  ["post_apocalypse", "post-apocalyptic"],
  ["survival", "survival"],
  ["superhero", "superhero"],
  ["space", "space"],
  ["time_travel", "time travel"],
  ["disaster", "disaster"],
  ["zombie", "zombie"],
  ["alien", "alien"],
  ["dystopia", "dystopia"],
  ["horror", "horror"],
  ["sci_fi", "science fiction"],
] as const;

const seriesKeywords = [
  ["post_apocalypse", "post-apocalyptic"],
  ["survival", "survival"],
  ["zombie", "zombie"],
  ["alien", "alien"],
  ["dystopia", "dystopia"],
  ["horror", "horror"],
  ["sci_fi", "science fiction"],
  ["mystery", "mystery"],
] as const;

// IDs below identify automatic TMDB sources, never individual films.
export const TREND_SOURCE_RULES: TrendSourceRule[] = [
  { source: "TMDB_COMPANY", category: "marvel", entity: "company", query: "Marvel Studios", type: ContentType.MOVIE, discoverParam: "with_companies", weight: 16 },
  { source: "TMDB_NETWORK", category: "hbo", entity: "network", entityId: 49, type: ContentType.SERIES, discoverParam: "with_networks", weight: 16 },
  { source: "TMDB_NETWORK", category: "netflix", entity: "network", entityId: 213, type: ContentType.SERIES, discoverParam: "with_networks", weight: 14 },
  { source: "TMDB_NETWORK", category: "amc", entity: "network", entityId: 174, type: ContentType.SERIES, discoverParam: "with_networks", weight: 13 },
  { source: "TMDB_PERSON", category: "nolan", entity: "person", query: "Christopher Nolan", type: ContentType.MOVIE, discoverParam: "with_people", weight: 15 },
  { source: "TMDB_COLLECTION", category: "spider_man", entity: "collection", query: "Spider-Man Collection", type: ContentType.MOVIE, weight: 15 },
  { source: "TMDB_COLLECTION", category: "iron_man", entity: "collection", query: "Iron Man Collection", type: ContentType.MOVIE, weight: 14 },
  ...movieKeywords.map(([category, query]) => ({ source: "TMDB_KEYWORD" as const, category, entity: "keyword" as const, query, type: ContentType.MOVIE, discoverParam: "with_keywords" as const, weight: 10 })),
  ...seriesKeywords.map(([category, query]) => ({ source: "TMDB_KEYWORD" as const, category, entity: "keyword" as const, query, type: ContentType.SERIES, discoverParam: "with_keywords" as const, weight: 11 })),
];

export function trendCategorySlug(category: string) {
  return slugify(category.replaceAll("_", " "));
}

const CATEGORY_TITLES: Record<string, string> = {
  marvel: "Фильмы Marvel",
  spider_man: "Фильмы о Человеке-пауке",
  iron_man: "Фильмы о Железном человеке",
  nolan: "Фильмы Кристофера Нолана",
  hbo: "Сериалы HBO",
  netflix: "Популярные сериалы Netflix",
  amc: "Сериалы AMC",
  post_apocalypse: "Фильмы и сериалы про конец света",
  survival: "Фильмы и сериалы про выживание",
  sci_fi: "Научная фантастика",
  horror: "Фильмы и сериалы ужасов",
  disaster: "Фильмы-катастрофы",
  space: "Фильмы и сериалы про космос",
  time_travel: "Фильмы о путешествиях во времени",
  zombie: "Фильмы и сериалы про зомби",
  superhero: "Фильмы о супергероях",
  mystery: "Мистические сериалы",
  trending: "В тренде",
  top_rated: "Лучшее по рейтингам",
  article_mention: "Обсуждаемые фильмы и сериалы",
};

export function trendCategoryTitle(category: string) {
  return CATEGORY_TITLES[category] ?? category.replaceAll("_", " ");
}
