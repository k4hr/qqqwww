import type { ContentType } from "@prisma/client";

export const discoveryMoods = [
  { key: "evening", label: "На вечер", description: "Надёжные хиты и свежие картины без лишнего поиска." },
  { key: "action", label: "Драйв", description: "Боевики, триллеры и фантастика с высоким темпом." },
  { key: "comfort", label: "Лёгкое", description: "Комедии, семейное кино и приключения." },
  { key: "deep", label: "Серьёзное", description: "Драмы, детективы и криминальные истории." },
  { key: "new", label: "Новое", description: "Свежие добавления и релизы последних лет." },
] as const;

export type DiscoveryMood = typeof discoveryMoods[number]["key"];

export type DiscoveryMovie = {
  id: string;
  slug: string;
  titleRu: string;
  year: number;
  type: ContentType;
  posterUrl: string | null;
  quality: string;
  kpRating: number | null;
  imdbRating: number | null;
  description: string;
  country: string | null;
  homeScore: number;
  trendScore: number;
};

export function normalizeDiscoveryMood(value: unknown): DiscoveryMood {
  return discoveryMoods.some((mood) => mood.key === value) ? value as DiscoveryMood : "evening";
}
