import { ContentType, type Prisma } from "@prisma/client";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { vibixPublicMovieWhere, vibixWatchMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";
import { getSearchTextForms, normalizeSearchText, parseSearchIntent, type SearchProvenance } from "@/lib/search-v2";

const searchInclude = { genres: { include: { genre: true } } } as const;
export type SearchMovie = Prisma.MovieGetPayload<{ include: typeof searchInclude }>;

const RU_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const EN_TO_RU_LAYOUT: Record<string, string> = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з", "[": "х", "]": "ъ",
  a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л", l: "д", ";": "ж", "'": "э",
  z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь", ",": "б", ".": "ю", "`": "ё",
};

const RU_TO_EN_LAYOUT = Object.fromEntries(Object.entries(EN_TO_RU_LAYOUT).map(([en, ru]) => [ru, en])) as Record<string, string>;
const WORD_BOUNDARY_PATTERN = /[\s:;,.!?()[\]{}<>«»"'`~|\\/_+–—-]/;
const SHORT_TOKEN_MAX_PREFIX_EXTRA = 2;

const INTENT_STOP_WORDS = new Set([
  "смотреть", "посмотреть", "смотри", "смотрим", "watch", "smotret",
  "онлайн", "online", "бесплатно", "бесплатный", "free", "без", "регистрации",
  "фильм", "фильмы", "фильма", "кино", "movie", "movies", "film", "films",
  "сериал", "сериалы", "сериала", "series", "serial", "tv", "show",
  "мультфильм", "мультфильмы", "мульт", "мультик", "мультики", "cartoon", "cartoons",
  "аниме", "анимэ", "anime",
  "в", "во", "на", "с", "со", "для", "hd", "fullhd", "fhd", "uhd", "4k", "1080", "1080p", "720", "720p",
]);

const SEARCH_ALIASES: Record<string, string[]> = {
  "железный человек": ["iron man", "iron-man", "ironman", "zhelezny chelovek", "zheleznyi chelovek"],
  "человек паук": ["spider man", "spider-man", "spiderman", "chelovek pauk"],
  "извне": ["from"],
  "ходячие мертвецы": ["walking dead", "the walking dead", "hodjachie mertvecy", "hodyachie mertvecy"],
  "игра престолов": ["game of thrones"],
  "гарри поттер": ["harry potter", "garri potter"],
  "елки": ["ёлки", "yolki", "elki"],
  "интерстеллар": ["interstellar", "интерстелар"],
  "наруто": ["naruto"],
  "тор": ["thor"],
  "мстители": ["avengers"],
  "бэтмен": ["batman"],
  "джокер": ["joker"],
  "форсаж": ["fast and furious", "fast furious"],
};

for (const [key, aliases] of Object.entries({ ...SEARCH_ALIASES })) {
  const normalizedKey = normalizeSearchQuery(key);
  SEARCH_ALIASES[normalizedKey] = Array.from(new Set([...(SEARCH_ALIASES[normalizedKey] ?? []), ...aliases]));
  for (const alias of aliases) {
    const normalizedAlias = normalizeSearchQuery(alias);
    SEARCH_ALIASES[normalizedAlias] = Array.from(new Set([...(SEARCH_ALIASES[normalizedAlias] ?? []), normalizedKey]));
  }
}

const RUSSIAN_STEM_ENDINGS = [
  "иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими",
  "иях", "ах", "ях", "ией", "ия", "ие", "ий", "ый", "ой", "ая", "яя", "ое", "ее",
  "ов", "ев", "ей", "ам", "ям", "ом", "ем", "ою", "ею", "а", "я", "ы", "и", "е", "у", "ю",
];

function russianStemToken(token: string) {
  if (!/^[а-я]+$/.test(token) || token.length < 5) return token;
  for (const ending of RUSSIAN_STEM_ENDINGS) {
    if (token.endsWith(ending) && token.length - ending.length >= 3) return token.slice(0, -ending.length);
  }
  return token;
}

function stemSearchPhrase(value: string) {
  const tokens = normalizeSearchQuery(value).split(" ").filter(Boolean);
  return tokens.map((token) => (/^\d+$/.test(token) ? token : russianStemToken(token))).join(" ").trim();
}

export function normalizeSearchQuery(query: string) {
  return normalizeSearchText(query).spaced
    .replace(/\b(\d{1,3})(?:й|ый|ой|ий|ая|я|го|ого|ому|ему)\b/g, "$1")
    .replace(/\b(\d{1,3})\s+(?:й|ый|ой|ий|ая|я|го|ого|ому|ему)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchIntentQuery(query: string) {
  const parsed = parseSearchIntent(query);
  const normalized = normalizeSearchQuery(parsed.titleQuery || parsed.normalizedQuery);
  const tokens = normalized.split(" ").filter((token) => token && !INTENT_STOP_WORDS.has(token));
  return tokens.join(" ").trim() || normalized;
}

export function tokenizeSearchQuery(query: string) {
  return Array.from(new Set(
    normalizeSearchQuery(query)
      .split(" ")
      .map((token) => russianStemToken(token))
      .filter((token) => token.length >= 2 || /^\d+$/.test(token)),
  ));
}

export function transliterateSearchQuery(query: string) {
  return normalizeSearchQuery(query).split("").map((letter) => RU_TO_LATIN[letter] ?? letter).join("");
}

function convertKeyboardLayout(query: string, direction: "en-to-ru" | "ru-to-en") {
  const dictionary = direction === "en-to-ru" ? EN_TO_RU_LAYOUT : RU_TO_EN_LAYOUT;
  return normalizeSearchQuery(query.toLocaleLowerCase("ru-RU").split("").map((letter) => dictionary[letter] ?? letter).join(""));
}

function addUnique(target: string[], value: string | null | undefined) {
  const normalized = normalizeSearchQuery(value ?? "");
  if (normalized && !target.includes(normalized)) target.push(normalized);
}

function addQueryShapeVariants(target: string[], value: string) {
  const normalized = normalizeSearchQuery(value);
  if (!normalized) return;

  addUnique(target, normalized);
  addUnique(target, transliterateSearchQuery(normalized));
  addUnique(target, convertKeyboardLayout(normalized, "en-to-ru"));
  addUnique(target, convertKeyboardLayout(normalized, "ru-to-en"));
  for (const form of getSearchTextForms(normalized)) addUnique(target, form);

  if (normalized.includes(" ")) {
    addUnique(target, normalized.replace(/\s+/g, "-"));
    addUnique(target, normalized.replace(/\s+/g, ""));
  }
}

function addAliasVariants(target: string[], normalized: string) {
  for (const alias of SEARCH_ALIASES[normalized] ?? []) addQueryShapeVariants(target, alias);
  for (const token of tokenizeSearchQuery(normalized)) {
    for (const alias of SEARCH_ALIASES[token] ?? []) addQueryShapeVariants(target, alias);
  }
  if (normalized.length >= 4) {
    for (const [aliasKey, aliases] of Object.entries(SEARCH_ALIASES)) {
      if (aliasKey.startsWith(normalized)) {
        addQueryShapeVariants(target, aliasKey);
        for (const alias of aliases) addQueryShapeVariants(target, alias);
      }
    }
  }
}

function buildSearchVariants(query: string) {
  const variants: string[] = [];
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  addQueryShapeVariants(variants, intent);
  addAliasVariants(variants, intent);

  const stemmed = stemSearchPhrase(intent);
  if (stemmed && stemmed !== intent) {
    addQueryShapeVariants(variants, stemmed);
    addAliasVariants(variants, stemmed);
  }

  if (normalized !== intent) {
    addQueryShapeVariants(variants, normalized);
    addAliasVariants(variants, normalized);
  }

  return variants.slice(0, 18);
}

function isShortSingleToken(query: string) {
  const tokens = tokenizeSearchQuery(query);
  return tokens.length === 1 && tokens[0].length <= 3;
}

type SearchTextField = "titleRu" | "titleOriginal" | "slug";

function textFieldWhere(field: SearchTextField, condition: Prisma.StringFilter<"Movie">): Prisma.MovieWhereInput {
  if (field === "titleRu") return { titleRu: condition };
  if (field === "titleOriginal") return { titleOriginal: condition };
  return { slug: condition };
}

function titleFieldWhere(value: string, relaxedContains: boolean): Prisma.MovieWhereInput[] {
  const normalized = normalizeSearchQuery(value);
  if (!normalized) return [];
  const boundaryQueries = [` ${normalized}`, `-${normalized}`, `: ${normalized}`, `. ${normalized}`, `, ${normalized}`, `«${normalized}`, `"${normalized}`, `(${normalized}`];
  const fields: SearchTextField[] = ["titleRu", "titleOriginal", "slug"];
  const where: Prisma.MovieWhereInput[] = [];

  for (const field of fields) {
    where.push(textFieldWhere(field, { equals: normalized, mode: "insensitive" }));
    where.push(textFieldWhere(field, { startsWith: normalized, mode: "insensitive" }));
    for (const boundaryValue of boundaryQueries) where.push(textFieldWhere(field, { contains: boundaryValue, mode: "insensitive" }));
    if (relaxedContains) where.push(textFieldWhere(field, { contains: normalized, mode: "insensitive" }));
  }

  return where;
}

function titleTokenAndWhere(value: string): Prisma.MovieWhereInput[] {
  const tokens = tokenizeSearchQuery(value).filter((token) => token.length >= 3 || /^\d+$/.test(token));
  const wordTokens = tokens.filter((token) => !/^\d+$/.test(token));
  if (tokens.length < 2 && wordTokens.length < 1) return [];
  const fields: SearchTextField[] = ["titleRu", "titleOriginal", "slug"];
  return fields.map((field) => ({ AND: tokens.map((token) => textFieldWhere(field, { contains: token, mode: "insensitive" })) }));
}

function idWhere(query: string): Prisma.MovieWhereInput[] {
  const compact = normalizeSearchQuery(query).replace(/\s+/g, "");
  const where: Prisma.MovieWhereInput[] = [];
  if (/^tt\d{4,}$/i.test(compact)) where.push({ imdbId: { equals: compact, mode: "insensitive" } });
  if (/^\d{3,}$/.test(compact)) {
    where.push({ kinopoiskId: { equals: compact, mode: "insensitive" } });
    where.push({ tmdbId: { equals: compact, mode: "insensitive" } });
    const maybeVibixId = Number(compact);
    if (Number.isSafeInteger(maybeVibixId)) where.push({ vibixId: maybeVibixId });
  }
  return where;
}

function metadataWhere(query: string): Prisma.MovieWhereInput[] {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 4) return [];
  return [
    { genres: { some: { genre: { name: { equals: normalized, mode: "insensitive" } } } } },
    { genres: { some: { genre: { name: { startsWith: normalized, mode: "insensitive" } } } } },
    { country: { contains: normalized, mode: "insensitive" } },
  ];
}

function typoTokenVariants(token: string) {
  if (token.length < 5 || /^\d+$/.test(token)) return [token];
  const variants = new Set<string>([token, russianStemToken(token)]);
  for (let index = 0; index < token.length; index += 1) {
    const shortened = token.slice(0, index) + token.slice(index + 1);
    if (shortened.length >= 4) variants.add(shortened);
    if (variants.size >= 7) break;
  }
  return [...variants].slice(0, 7);
}

function fuzzyRetrievalWhere(query: string): Prisma.MovieWhereInput {
  const tokens = tokenizeSearchQuery(query)
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token))
    .slice(0, 3);
  if (!tokens.length) return {};

  return {
    AND: tokens.map((token) => ({
      OR: typoTokenVariants(token).flatMap((variant) => [
        { titleRu: { contains: variant, mode: "insensitive" as const } },
        { titleOriginal: { contains: variant, mode: "insensitive" as const } },
        { slug: { contains: variant, mode: "insensitive" as const } },
      ]),
    })),
  };
}

export function buildSearchWhere(query: string): Prisma.MovieWhereInput {
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  const variants = buildSearchVariants(normalized);
  if (!variants.length) return {};
  const relaxedContains = !isShortSingleToken(intent);
  const OR = [
    ...idWhere(intent),
    ...(intent !== normalized ? idWhere(normalized) : []),
    ...variants.flatMap((variant) => [...titleFieldWhere(variant, relaxedContains), ...titleTokenAndWhere(variant)]),
    ...metadataWhere(intent),
    ...(intent !== normalized ? metadataWhere(normalized) : []),
  ];
  return OR.length ? { OR } : {};
}

function editDistance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    let rowMin = previous[0];
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
      rowMin = Math.min(rowMin, previous[j]);
    }
    if (rowMin > 2) return 3;
  }
  return previous[right.length];
}

function splitWords(text: string) {
  return normalizeSearchQuery(text).split(" ").filter(Boolean);
}

function hasBoundaryAfter(text: string, position: number, phrase: string) {
  const next = text[position + phrase.length];
  return !next || WORD_BOUNDARY_PATTERN.test(next);
}

function hasBoundaryBefore(text: string, position: number) {
  const previous = text[position - 1];
  return !previous || WORD_BOUNDARY_PATTERN.test(previous);
}

function phraseAtWordBoundary(text: string, phrase: string) {
  if (!text || !phrase) return false;
  let fromIndex = 0;
  while (fromIndex <= text.length) {
    const position = text.indexOf(phrase, fromIndex);
    if (position < 0) return false;
    if (hasBoundaryBefore(text, position) && hasBoundaryAfter(text, position, phrase)) return true;
    fromIndex = position + 1;
  }
  return false;
}

function phraseStartsAtBoundary(text: string, phrase: string) {
  return Boolean(text && phrase && (text === phrase || (text.startsWith(phrase) && hasBoundaryAfter(text, 0, phrase))));
}

function isAllowedShortPrefix(token: string, word: string) {
  if (!word.startsWith(token)) return false;
  return token.length >= 4 || word.length <= token.length + SHORT_TOKEN_MAX_PREFIX_EXTRA;
}

function firstNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function popularityBoost(movie: SearchMovie) {
  const rating = Math.max(firstNumber(movie.kpRating), firstNumber(movie.imdbRating), firstNumber(movie.tmdbRating));
  const votes = Math.max(firstNumber(movie.kpVotes), firstNumber(movie.imdbVotes), firstNumber(movie.tmdbVotes));
  const voteBoost = votes > 0 ? Math.min(18, Math.log10(votes + 1) * 2.2) : 0;
  const scoreBoost = Math.max(firstNumber(movie.homeScore), firstNumber(movie.catalogScore), firstNumber(movie.popularScore), firstNumber(movie.topScore)) / 12;
  return Math.min(35, rating + voteBoost + scoreBoost);
}

function scoreOneTextField(text: string, variant: string, tokens: string[], exactWeight: number, prefixWeight: number, wordWeight: number) {
  const normalizedText = normalizeSearchQuery(text);
  if (!normalizedText || !variant) return 0;
  const words = splitWords(normalizedText);
  let score = 0;
  if (normalizedText === variant) score += exactWeight;
  else if (phraseStartsAtBoundary(normalizedText, variant)) score += prefixWeight;
  else if (phraseAtWordBoundary(normalizedText, variant)) score += wordWeight;

  let matchedTokens = 0;
  for (const token of tokens) {
    const exactWord = words.includes(token);
    const prefixWord = words.some((word) => isAllowedShortPrefix(token, word));
    const fuzzyWord = token.length >= 4 && words.some((word) => editDistance(token, word) <= (token.length >= 7 ? 2 : 1));
    if (exactWord) {
      matchedTokens += 1;
      score += 22;
    } else if (prefixWord) {
      matchedTokens += 1;
      score += token.length <= 3 ? 10 : 15;
    } else if (fuzzyWord) {
      matchedTokens += 1;
      score += 8;
    }
  }
  if (tokens.length && matchedTokens === tokens.length) score += tokens.length >= 2 ? 28 : 12;
  return score;
}

export function scoreSearchResult(movie: SearchMovie, query: string) {
  const parsed = parseSearchIntent(query);
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  const variants = buildSearchVariants(normalized);
  const tokens = tokenizeSearchQuery(intent);
  if (!intent || !tokens.length || !variants.length) return 0;

  let score = 0;
  const idQuery = intent.replace(/\s+/g, "");
  if (idQuery && idQuery === normalizeSearchQuery(movie.kinopoiskId ?? "")) score += 260;
  if (idQuery && idQuery === normalizeSearchQuery(movie.imdbId ?? "")) score += 260;
  if (idQuery && idQuery === normalizeSearchQuery(movie.tmdbId ?? "")) score += 190;
  if (/^\d+$/.test(idQuery) && movie.vibixId === Number(idQuery)) score += 190;

  for (const variant of variants) {
    const variantTokens = tokenizeSearchQuery(variant);
    const aliasPenalty = variant === intent ? 0 : 18;
    const titleRuScore = Math.max(0, scoreOneTextField(movie.titleRu, variant, variantTokens, 210, 165, 132) - aliasPenalty);
    const titleOriginalScore = Math.max(0, scoreOneTextField(movie.titleOriginal ?? "", variant, variantTokens, 185, 145, 112) - aliasPenalty);
    const slugScore = Math.max(0, scoreOneTextField(movie.slug, variant, variantTokens, 135, 105, 85) - aliasPenalty);
    score = Math.max(score, titleRuScore, titleOriginalScore, slugScore);
  }

  if (tokens.some((token) => token === String(movie.year))) score += 40;
  if (parsed.type && movie.type === parsed.type) score += 50;
  if (parsed.season && movie.type === ContentType.SERIES) {
    score += 85;
    if ((movie.vibixSeasonCount ?? 0) >= parsed.season.season) score += 45;
  }

  if (intent.length >= 4) {
    const genreWords = movie.genres.flatMap((item) => splitWords(item.genre.name));
    if (tokens.some((token) => genreWords.includes(token))) score += 18;
    if (movie.country && phraseAtWordBoundary(normalizeSearchQuery(movie.country), intent)) score += 12;
  }

  if (isShortSingleToken(intent) && score < 70) return 0;
  if (score <= 0) return 0;
  if (movie.vibixAvailable) score += 8;
  if (movie.posterUrl) score += 5;
  if (movie.isPublicVisible) score += 8;
  if (movie.isHomeEligible || movie.isPopularEligible || movie.isTopEligible) score += 5;
  score += popularityBoost(movie);
  return score;
}

export function explainSearchResult(movie: SearchMovie, query: string): { score: number; provenance: SearchProvenance[]; parsed: ReturnType<typeof parseSearchIntent> } {
  const parsed = parseSearchIntent(query);
  const intent = normalizeSearchIntentQuery(query);
  const variants = buildSearchVariants(query);
  const provenance = new Set<SearchProvenance>();
  const idQuery = normalizeSearchQuery(intent).replace(/\s+/g, "");
  const titleRu = normalizeSearchQuery(movie.titleRu);
  const titleOriginal = normalizeSearchQuery(movie.titleOriginal ?? "");
  const slug = normalizeSearchQuery(movie.slug);
  const compactTitle = normalizeSearchText(`${movie.titleRu} ${movie.titleOriginal ?? ""}`).compact;

  if (idQuery && (
    idQuery === normalizeSearchQuery(movie.kinopoiskId ?? "")
    || idQuery === normalizeSearchQuery(movie.imdbId ?? "")
    || idQuery === normalizeSearchQuery(movie.tmdbId ?? "")
    || (/^\d+$/.test(idQuery) && movie.vibixId === Number(idQuery))
  )) provenance.add("ID");

  for (const variant of variants) {
    const variantCompact = normalizeSearchText(variant).compact;
    const variantTokens = tokenizeSearchQuery(variant);
    if (titleRu === variant) provenance.add("EXACT_TITLE_RU");
    if (titleOriginal && titleOriginal === variant) provenance.add("EXACT_ORIGINAL_TITLE");
    if (SEARCH_ALIASES[variant]?.length) provenance.add("EXACT_ALIAS");
    if (variantCompact && compactTitle === variantCompact) provenance.add("EXACT_COMPACT_TITLE");
    if (phraseStartsAtBoundary(titleRu, variant) || (titleOriginal && phraseStartsAtBoundary(titleOriginal, variant))) provenance.add("PREFIX");
    if (variantTokens.length && variantTokens.every((token) => splitWords(titleRu).includes(token) || splitWords(titleOriginal).includes(token) || splitWords(slug).includes(token))) provenance.add("ALL_TITLE_TOKENS");
    if (variant === transliterateSearchQuery(intent)) provenance.add("TRANSLITERATION");
    if (variant === convertKeyboardLayout(intent, "en-to-ru") || variant === convertKeyboardLayout(intent, "ru-to-en")) provenance.add("KEYBOARD_LAYOUT");
    if (variantTokens.some((token) => token.length >= 4 && [...splitWords(titleRu), ...splitWords(titleOriginal)].some((word) => editDistance(token, word) <= (token.length >= 7 ? 2 : 1)))) provenance.add("FUZZY");
  }

  const tokens = tokenizeSearchQuery(intent);
  if (intent.length >= 4) {
    const genreWords = movie.genres.flatMap((item) => splitWords(item.genre.name));
    if (tokens.some((token) => genreWords.includes(token)) || (movie.country && phraseAtWordBoundary(normalizeSearchQuery(movie.country), intent))) provenance.add("GENRE_COUNTRY");
    if (movie.description && tokens.some((token) => token.length >= 4 && phraseAtWordBoundary(normalizeSearchQuery(movie.description), token))) provenance.add("DESCRIPTION");
  }

  return { score: scoreSearchResult(movie, query), provenance: provenance.size ? [...provenance] : ["NONE"], parsed };
}

export type SearchFilters = { type?: string; year?: string; genre?: string; country?: string };

function filterWhere(filters: SearchFilters, hasQuery: boolean): Prisma.MovieWhereInput {
  const type = Object.values(ContentType).includes(filters.type as ContentType) ? filters.type as ContentType : undefined;
  const year = /^(19|20)\d{2}$/.test(filters.year ?? "") ? Number(filters.year) : undefined;
  return {
    AND: [
      hasQuery ? vibixWatchMovieWhere : vibixPublicMovieWhere,
      buildCountryFilterWhere(normalizeCatalogCountry(filters.country ?? (hasQuery ? "all" : "main"))),
      ...(type ? [{ type }] : []),
      ...(year ? [{ year }] : []),
      ...(filters.genre ? [{ genres: { some: { genre: { slug: filters.genre } } } }] : []),
    ],
  };
}

function uniqueMovies(movies: SearchMovie[]) {
  return Array.from(new Map(movies.map((movie) => [movie.id, movie])).values());
}

async function searchMoviesOnce(query: string, filters: SearchFilters, limit: number): Promise<SearchMovie[]> {
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  const baseWhere = filterWhere(filters, Boolean(intent));
  if (!intent) return [];

  const take = Math.min(320, Math.max(100, limit * 10));
  const strictWhere = buildSearchWhere(normalized);
  let candidates = await prisma.movie.findMany({
    where: { AND: [baseWhere, strictWhere] },
    include: searchInclude,
    orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take,
  });

  if (!isShortSingleToken(intent) && candidates.length < Math.min(16, limit)) {
    const relaxedVariants = buildSearchVariants(normalized).filter((variant) => variant.length >= 4);
    if (relaxedVariants.length) {
      const relaxed = await prisma.movie.findMany({
        where: {
          AND: [
            baseWhere,
            {
              OR: relaxedVariants.flatMap((variant) => [
                { titleRu: { contains: variant, mode: "insensitive" } },
                { titleOriginal: { contains: variant, mode: "insensitive" } },
                { description: { contains: variant, mode: "insensitive" } },
                { genres: { some: { genre: { name: { contains: variant, mode: "insensitive" } } } } },
              ]),
            },
          ],
        },
        include: searchInclude,
        orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
        take: Math.min(160, take),
      });
      candidates = uniqueMovies([...candidates, ...relaxed]);
    }
  }

  if (!isShortSingleToken(intent) && candidates.length < Math.min(12, limit)) {
    const fuzzyWhere = fuzzyRetrievalWhere(intent);
    if (Object.keys(fuzzyWhere).length) {
      const fuzzy = await prisma.movie.findMany({
        where: { AND: [baseWhere, fuzzyWhere] },
        include: searchInclude,
        orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
        take: Math.min(90, take),
      });
      candidates = uniqueMovies([...candidates, ...fuzzy]);
    }
  }

  return candidates
    .map((movie) => ({ movie, score: scoreSearchResult(movie, query) }))
    .filter((item) => item.score >= 70)
    .sort((a, b) => b.score - a.score || popularityBoost(b.movie) - popularityBoost(a.movie) || (b.movie.year ?? 0) - (a.movie.year ?? 0))
    .slice(0, limit)
    .map((item) => item.movie);
}

export async function searchMovies(query: string, filters: SearchFilters = {}, limit = 48) {
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  if (!intent) return [];

  const batches: SearchMovie[][] = [];
  batches.push(await searchMoviesOnce(normalized, filters, limit));

  const merged = uniqueMovies(batches.flat());
  return merged
    .map((movie) => ({ movie, score: scoreSearchResult(movie, normalized) }))
    .filter((item) => item.score >= 70)
    .sort((a, b) => b.score - a.score || popularityBoost(b.movie) - popularityBoost(a.movie) || (b.movie.year ?? 0) - (a.movie.year ?? 0))
    .slice(0, limit)
    .map((item) => item.movie);
}
