import { ContentType, type Movie } from "@prisma/client";

export type CatalogKindInput = Partial<Pick<Movie,
  | "type"
  | "titleRu"
  | "titleOriginal"
  | "description"
  | "country"
  | "vibixType"
  | "vibixTags"
>> & {
  genres?: { genre: { name?: string | null; slug?: string | null } }[];
  raw?: Record<string, unknown> | null;
};

const ANIME_MARKERS = [
  "аниме",
  "anime",
  "japan animation",
  "japanese animation",
  "манга",
  "manga",
  "ova",
  "ona",
  "shounen",
  "shonen",
  "seinen",
  "shoujo",
  "shojo",
  "josei",
];

const CARTOON_MARKERS = [
  "мультфильм",
  "мультфильмы",
  "мультсериал",
  "мультсериалы",
  "мультик",
  "мультики",
  "анимация",
  "анимационный",
  "анимационная",
  "animation",
  "animated",
  "cartoon",
  "cartoons",
  "мультипликация",
];

function normalizeText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[\s_]+/g, " ").trim();
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function collectUnknown(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = stringValue(value);
    return text ? [text] : [];
  }
  if (Array.isArray(value)) return value.flatMap(collectUnknown);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct = stringValue(record.name_rus) || stringValue(record.name) || stringValue(record.title) || stringValue(record.value) || stringValue(record.slug);
    const nested = Object.entries(record)
      .filter(([key]) => !["poster", "poster_url", "backdrop", "backdrop_url", "iframe_url", "embed_code", "description"].includes(key))
      .flatMap(([, item]) => collectUnknown(item));
    return direct ? [direct, ...nested] : nested;
  }
  return [];
}

function hasMarker(text: string, markers: readonly string[]) {
  const normalized = normalizeText(text);
  return markers.some((marker) => normalized.includes(normalizeText(marker)));
}

export function rawVibixTypeToBaseContentType(value?: unknown): ContentType {
  const normalized = normalizeText(stringValue(value) ?? "");
  if (["serial", "series", "tv", "tv series", "tv_series", "show"].includes(normalized)) return ContentType.SERIES;
  return ContentType.MOVIE;
}

export function classifyCatalogKind(input: CatalogKindInput): ContentType {
  const raw = input.raw ?? {};
  const rawGenre = collectUnknown(raw.genre);
  const rawTags = collectUnknown(raw.tags);
  const rawCategory = collectUnknown(raw.category ?? raw.categories ?? raw.category_name ?? raw.categoryName ?? raw.type_name ?? raw.typeName);
  const rawTitle = collectUnknown([raw.name_rus, raw.name, raw.name_eng, raw.name_original]);
  const rawDescription = collectUnknown([raw.description, raw.description_short]);
  const relationGenres = input.genres?.flatMap((item) => [item.genre.name, item.genre.slug].filter(Boolean) as string[]) ?? [];
  const text = [
    input.titleRu,
    input.titleOriginal,
    input.description,
    input.country,
    input.vibixType,
    ...(input.vibixTags ?? []),
    ...relationGenres,
    ...rawGenre,
    ...rawTags,
    ...rawCategory,
    ...rawTitle,
    ...rawDescription,
  ].filter(Boolean).join(" ");

  if (hasMarker(text, ANIME_MARKERS)) return ContentType.ANIME;
  if (hasMarker(text, CARTOON_MARKERS)) return ContentType.CARTOON;

  const fallbackType = input.type ?? rawVibixTypeToBaseContentType(input.vibixType ?? raw.type);
  if (fallbackType === ContentType.ANIME || fallbackType === ContentType.CARTOON) return fallbackType;
  return fallbackType === ContentType.SERIES ? ContentType.SERIES : ContentType.MOVIE;
}

export function classifyCatalogKindFromVibix(raw: Record<string, unknown>, fallbackType?: ContentType) {
  return classifyCatalogKind({ raw, type: fallbackType, vibixType: stringValue(raw.type) });
}

export function isKidsAnimationKind(type: ContentType) {
  return type === ContentType.CARTOON || type === ContentType.ANIME;
}
