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

const EXPLICIT_ANIME_MARKERS = [
  "аниме",
  "anime",
  "japan animation",
  "japanese animation",
  "манга",
  "manga",
];

const ANIME_EXACT_TOKENS = [
  "ova",
  "ona",
  "oav",
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
      .filter(([key]) => !["poster", "poster_url", "backdrop", "backdrop_url", "iframe_url", "embed_code", "description", "description_short"].includes(key))
      .flatMap(([, item]) => collectUnknown(item));
    return direct ? [direct, ...nested] : nested;
  }
  return [];
}

function textHasMarker(text: string, markers: readonly string[]) {
  const normalized = normalizeText(text);
  return markers.some((marker) => normalized.includes(normalizeText(marker)));
}

function textHasExactToken(text: string, tokens: readonly string[]) {
  const normalizedTokens = normalizeText(text)
    .split(/[^a-zа-я0-9]+/iu)
    .filter(Boolean);
  const tokenSet = new Set(normalizedTokens);
  return tokens.some((token) => tokenSet.has(normalizeText(token)));
}

function isJapanCountry(text: string) {
  const normalized = normalizeText(text);
  return normalized.includes("япон") || normalized.includes("japan");
}

function buildTextParts(input: CatalogKindInput) {
  const raw = input.raw ?? {};
  const rawGenre = collectUnknown(raw.genre);
  const rawTags = collectUnknown(raw.tags);
  const rawCategory = collectUnknown(raw.category ?? raw.categories ?? raw.category_name ?? raw.categoryName ?? raw.type_name ?? raw.typeName);
  const rawTitle = collectUnknown([raw.name_rus, raw.name, raw.name_eng, raw.name_original]);
  const rawDescription = collectUnknown([raw.description, raw.description_short]);
  const relationGenres = input.genres?.flatMap((item) => [item.genre.name, item.genre.slug].filter(Boolean) as string[]) ?? [];

  const structuredText = [
    input.vibixType,
    ...(input.vibixTags ?? []),
    ...relationGenres,
    ...rawGenre,
    ...rawTags,
    ...rawCategory,
  ].filter(Boolean).join(" ");

  const titleText = [input.titleRu, input.titleOriginal, ...rawTitle].filter(Boolean).join(" ");
  const descriptionText = [input.description, ...rawDescription].filter(Boolean).join(" ");
  const countryText = [input.country, ...collectUnknown(raw.country)].filter(Boolean).join(" ");

  return {
    structuredText,
    titleText,
    descriptionText,
    countryText,
    allText: [structuredText, titleText, descriptionText, countryText].filter(Boolean).join(" "),
  };
}

export function hasStrictAnimeSignal(input: CatalogKindInput) {
  const parts = buildTextParts(input);
  const trustedText = [parts.structuredText, parts.titleText].join(" ");

  if (textHasMarker(trustedText, EXPLICIT_ANIME_MARKERS)) return true;

  // OVA/ONA are real anime category markers, but as plain substrings they create huge false positives:
  // persONA, BarcelONA, Ray DonOVAn, JonathAN etc. They must be matched only as separate tokens.
  if (textHasExactToken(parts.structuredText, ANIME_EXACT_TOKENS)) return true;

  // Japanese animation is anime. A normal Japanese/Korean/Chinese live-action title is not anime.
  return isJapanCountry(parts.countryText) && textHasMarker(parts.structuredText, CARTOON_MARKERS);
}

export function hasCartoonSignal(input: CatalogKindInput) {
  const parts = buildTextParts(input);
  return textHasMarker(parts.structuredText, CARTOON_MARKERS)
    || textHasMarker(parts.titleText, ["мультфильм", "мультсериал", "cartoon"])
    || textHasMarker(parts.descriptionText, ["мультфильм", "мультсериал"]);
}

export function rawVibixTypeToBaseContentType(value?: unknown): ContentType {
  const normalized = normalizeText(stringValue(value) ?? "");
  if (normalized.includes("anime") || normalized.includes("аниме")) return ContentType.ANIME;
  if (normalized.includes("cartoon") || normalized.includes("мульт") || normalized.includes("animation")) return ContentType.CARTOON;
  if (["serial", "series", "tv", "tv series", "tv_series", "show"].includes(normalized)) return ContentType.SERIES;
  return ContentType.MOVIE;
}

export function classifyCatalogKind(input: CatalogKindInput): ContentType {
  if (hasStrictAnimeSignal(input)) return ContentType.ANIME;
  if (hasCartoonSignal(input)) return ContentType.CARTOON;

  const baseType = rawVibixTypeToBaseContentType(input.vibixType ?? input.raw?.type);
  const storedType = input.type;

  if (storedType === ContentType.ANIME) {
    // Keep old ANIME records only when current data still contains a real anime signal.
    // Otherwise restore the technical Vibix base type when possible.
    return baseType === ContentType.SERIES ? ContentType.SERIES : ContentType.MOVIE;
  }

  if (storedType === ContentType.CARTOON) {
    return hasCartoonSignal(input) ? ContentType.CARTOON : baseType;
  }

  const fallbackType = storedType ?? baseType;
  return fallbackType === ContentType.SERIES ? ContentType.SERIES : ContentType.MOVIE;
}

export function classifyCatalogKindFromVibix(raw: Record<string, unknown>, fallbackType?: ContentType) {
  return classifyCatalogKind({ raw, type: fallbackType, vibixType: stringValue(raw.type) });
}

export function isKidsAnimationKind(type: ContentType) {
  return type === ContentType.CARTOON || type === ContentType.ANIME;
}
