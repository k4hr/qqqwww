import { ContentType } from "@prisma/client";

export type NormalizedSearchText = {
  raw: string;
  spaced: string;
  compact: string;
};

export type SearchSeasonIntent = {
  season: number;
  episode?: number;
  confirmed: boolean;
};

export type ParsedSearchIntent = {
  rawQuery: string;
  normalizedQuery: string;
  titleQuery: string;
  compactQuery: string;
  type?: ContentType;
  season?: SearchSeasonIntent;
  routeIntent?: "/films" | "/series" | "/cartoons" | "/anime" | "/latest" | "/popular" | "/collections";
  genericOnly: boolean;
};

export type SearchProvenance =
  | "ID"
  | "EXACT_TITLE_RU"
  | "EXACT_ORIGINAL_TITLE"
  | "EXACT_ALIAS"
  | "EXACT_COMPACT_TITLE"
  | "PREFIX"
  | "ALL_TITLE_TOKENS"
  | "TRANSLITERATION"
  | "KEYBOARD_LAYOUT"
  | "FUZZY"
  | "GENRE_COUNTRY"
  | "DESCRIPTION"
  | "NONE";

const ROUTE_TERMS: Array<{ route: NonNullable<ParsedSearchIntent["routeIntent"]>; type?: ContentType; terms: string[] }> = [
  { route: "/anime", type: ContentType.ANIME, terms: ["аниме", "анимэ", "anime"] },
  { route: "/cartoons", type: ContentType.CARTOON, terms: ["мультфильм", "мультфильмы", "мульт", "мультик", "мультики", "cartoon", "cartoons", "animation"] },
  { route: "/series", type: ContentType.SERIES, terms: ["сериал", "сериалы", "сериала", "series", "serial", "tv", "show"] },
  { route: "/films", type: ContentType.MOVIE, terms: ["фильм", "фильмы", "фильма", "кино", "movie", "movies", "film", "films"] },
];

const GENERIC_ROUTES: Array<{ route: NonNullable<ParsedSearchIntent["routeIntent"]>; terms: string[] }> = [
  { route: "/latest", terms: ["новинки", "новинка", "новое", "новые", "latest", "new"] },
  { route: "/popular", terms: ["популярное", "популярные", "популярный", "popular"] },
  { route: "/popular", terms: ["топ", "top", "лучшее", "лучшие", "rating", "рейтинг"] },
  { route: "/collections", terms: ["подборки", "подборка", "collections", "collection"] },
];

const SERVICE_WORDS = new Set([
  "смотреть", "посмотреть", "смотри", "смотрим", "watch",
  "онлайн", "online", "бесплатно", "бесплатный", "free", "без", "регистрации",
  "в", "во", "на", "с", "со", "для", "каталог", "раздел",
  "hd", "fullhd", "fhd", "uhd", "webdl", "webrip", "bdrip", "hdrip", "1080", "1080p", "720", "720p", "4k",
]);

const SEASON_WORD = "(?:сезон|сезона|сезоне|сезоны|season|sezon)";
const EPISODE_WORD = "(?:серия|серии|серий|эпизод|эпизода|episode|epizod)";
const ORDINAL_SUFFIX = "(?:й|ый|ой|ий|ая|я)?";

export function normalizeSearchText(value: unknown): NormalizedSearchText {
  const raw = String(value ?? "");
  const spaced = raw
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/&/g, " and ")
    .replace(/[‐‑‒–—−-]+/g, " ")
    .replace(/[.,:;!?()[\]{}<>«»"'“”„`~|\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    raw,
    spaced,
    compact: spaced.replace(/\s+/g, ""),
  };
}

export function getSearchTextForms(value: unknown) {
  const normalized = normalizeSearchText(value);
  const forms = new Set<string>();
  if (normalized.spaced) forms.add(normalized.spaced);
  if (normalized.compact && normalized.compact !== normalized.spaced) forms.add(normalized.compact);
  return [...forms];
}

function parseRomanNumeral(value: string) {
  const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return map[value.toLowerCase()] ?? null;
}

function parsePositiveInt(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseSeasonIntent(query: string): { season?: SearchSeasonIntent; titleQuery: string } {
  let normalized = normalizeSearchText(query).spaced;
  if (!normalized) return { titleQuery: "" };

  let season: number | null = null;
  let episode: number | null = null;

  const compactEpisode = normalized.match(/(?:^|\s)s\s*0?(\d{1,2})\s*e\s*0?(\d{1,3})(?:$|\s)/i);
  if (compactEpisode) {
    season = parsePositiveInt(compactEpisode[1]);
    episode = parsePositiveInt(compactEpisode[2]);
    normalized = normalized.replace(compactEpisode[0], " ");
  }

  const seasonShort = normalized.match(/(?:^|\s)s\s*0?(\d{1,2})(?:$|\s)/i);
  if (!season && seasonShort) {
    season = parsePositiveInt(seasonShort[1]);
    normalized = normalized.replace(seasonShort[0], " ");
  }

  const xEpisode = normalized.match(/(?:^|\s)0?(\d{1,2})\s*x\s*0?(\d{1,3})(?:$|\s)/i);
  if (!season && xEpisode) {
    season = parsePositiveInt(xEpisode[1]);
    episode = parsePositiveInt(xEpisode[2]);
    normalized = normalized.replace(xEpisode[0], " ");
  }

  const seasonBefore = normalized.match(new RegExp(`(?:^|\\s)${SEASON_WORD}\\s*0?(\\d{1,2})(?:$|\\s)`, "i"));
  if (!season && seasonBefore) {
    season = parsePositiveInt(seasonBefore[1]);
    normalized = normalized.replace(seasonBefore[0], " ");
  }

  const seasonAfter = normalized.match(new RegExp(`(?:^|\\s)0?(\\d{1,2})\\s*${ORDINAL_SUFFIX}\\s*${SEASON_WORD}(?:$|\\s)`, "i"));
  if (!season && seasonAfter) {
    season = parsePositiveInt(seasonAfter[1]);
    normalized = normalized.replace(seasonAfter[0], " ");
  }

  const joinedSeason = normalized.match(new RegExp(`(?:^|\\s)0?(\\d{1,2})${SEASON_WORD}(?:$|\\s)`, "i"));
  if (!season && joinedSeason) {
    season = parsePositiveInt(joinedSeason[1]);
    normalized = normalized.replace(joinedSeason[0], " ");
  }

  const episodeBefore = normalized.match(new RegExp(`(?:^|\\s)${EPISODE_WORD}\\s*0?(\\d{1,3})(?:$|\\s)`, "i"));
  if (episodeBefore) {
    episode = parsePositiveInt(episodeBefore[1]);
    normalized = normalized.replace(episodeBefore[0], " ");
  }

  const episodeAfter = normalized.match(new RegExp(`(?:^|\\s)0?(\\d{1,3})\\s*${ORDINAL_SUFFIX}\\s*${EPISODE_WORD}(?:$|\\s)`, "i"));
  if (episodeAfter) {
    episode = parsePositiveInt(episodeAfter[1]);
    normalized = normalized.replace(episodeAfter[0], " ");
  }

  const romanPart = normalized.match(/(?:^|\s)([ivx]{1,5})(?:$|\s)/i);
  const roman = romanPart ? parseRomanNumeral(romanPart[1]) : null;
  const titleHasSeasonWord = new RegExp(`(?:^|\\s)${SEASON_WORD}(?:$|\\s)`, "i").test(normalized);
  if (!season && titleHasSeasonWord && roman) {
    season = roman;
    normalized = normalized.replace(romanPart![0], " ");
  }

  normalized = normalizeSearchText(normalized).spaced;

  return {
    season: season ? { season, episode: episode ?? undefined, confirmed: true } : undefined,
    titleQuery: normalized,
  };
}

function routeTermForToken(token: string) {
  return ROUTE_TERMS.find((entry) => entry.terms.includes(token));
}

function genericRouteForToken(token: string) {
  return GENERIC_ROUTES.find((entry) => entry.terms.includes(token));
}

export function parseSearchIntent(query: string): ParsedSearchIntent {
  const normalized = normalizeSearchText(query);
  const seasonParsed = parseSeasonIntent(normalized.spaced);
  const tokens = seasonParsed.titleQuery.split(" ").filter(Boolean);
  let type: ContentType | undefined;
  let routeIntent: ParsedSearchIntent["routeIntent"];
  const titleTokens: string[] = [];
  const hasRouteOrGenericTerm = tokens.some((token) => Boolean(routeTermForToken(token) || genericRouteForToken(token)));

  for (const token of tokens) {
    const routeTerm = routeTermForToken(token);
    const genericRoute = genericRouteForToken(token);
    if (routeTerm) {
      type = type ?? routeTerm.type;
      routeIntent = routeIntent ?? routeTerm.route;
      continue;
    }
    if (genericRoute) {
      routeIntent = routeIntent ?? genericRoute.route;
      continue;
    }
    if (hasRouteOrGenericTerm && /^(19|20)\d{2}$/.test(token)) continue;
    if (SERVICE_WORDS.has(token)) continue;
    titleTokens.push(token);
  }

  const titleQuery = titleTokens.join(" ").trim();
  const genericOnly = !titleQuery && Boolean(routeIntent);

  return {
    rawQuery: normalized.raw,
    normalizedQuery: normalized.spaced,
    titleQuery: titleQuery || seasonParsed.titleQuery || normalized.spaced,
    compactQuery: normalizeSearchText(titleQuery || seasonParsed.titleQuery || normalized.spaced).compact,
    type,
    season: seasonParsed.season,
    routeIntent: genericOnly ? routeIntent : undefined,
    genericOnly,
  };
}
