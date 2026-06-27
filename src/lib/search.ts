import { ContentType, type Prisma } from "@prisma/client";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { vibixPublicMovieWhere, vibixWatchMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";

const searchInclude = { genres: { include: { genre: true } } } as const;
export type SearchMovie = Prisma.MovieGetPayload<{ include: typeof searchInclude }>;

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const WORD_BOUNDARY_PATTERN = /[\s:;,.!?()\[\]{}<>«»"'`~|\\/\-_+–—]/;
const SHORT_TOKEN_MAX_PREFIX_EXTRA = 2;


const SEARCH_INTENT_STOP_WORDS = new Set([
  "смотреть", "посмотреть", "смотри", "смотрим", "смотрет", "smotret", "watch",
  "онлайн", "online", "бесплатно", "бесплатный", "free", "без", "регистрации",
  "фильм", "фильмы", "фильма", "кино", "кинo", "movie", "movies",
  "сериал", "сериалы", "сериала", "series", "serial", "tv",
  "мультфильм", "мультфильмы", "мультик", "мультики", "cartoon",
  "аниме", "anime", "дорама", "дорамы",
  "хорошем", "хорошее", "хорошего", "качестве", "качество", "качеством", "quality",
  "озвучке", "озвучка", "дубляже", "дубляж", "русской", "русский", "русском",
  "полностью", "целиком", "подряд", "все", "весь", "вся", "всe",
  "hd", "fullhd", "fhd", "uhd", "webdl", "webrip", "bdrip", "hdrip", "1080", "1080p", "720", "720p", "4k",
]);

const SEARCH_INTENT_PHRASE_PATTERNS: RegExp[] = [
  /\b(?:s\s?\d{1,2}|season\s*\d{1,2}|sezon\s*\d{1,2})\b/gi,
  /\b(?:e\s?\d{1,3}|episode\s*\d{1,3}|epizod\s*\d{1,3})\b/gi,
  /\b\d{1,2}\s*x\s*\d{1,3}\b/gi,
  /\b\d{1,3}\s*(?:й|ый|ой|ий|ая|я)?\s*(?:сезон|сезона|сезоне|сезоны|серия|серии|серий|эпизод|эпизода|эпизоды)\b/gi,
  /\b(?:сезон|сезона|сезоне|сезоны|серия|серии|серий|эпизод|эпизода|эпизоды)\s*\d{1,3}\b/gi,
  /\b(?:все|вся|весь|all)\s+(?:сезоны|сезона|серии|серий|episodes|seasons)\b/gi,
  /\b(?:смотреть|посмотреть|watch)\s+(?:онлайн|online)\b/gi,
  /\b(?:в|во)\s+(?:хорошем|hd|fullhd|fhd|4k)\s+качестве\b/gi,
];

// Небольшой словарь нужен не для “Тора”, а для всей логики рус/англ франшиз.
// Поиск всё равно сначала ранжирует точные title matches, а алиасы только помогают найти оригинальные названия.
const SEARCH_ALIASES: Record<string, string[]> = {
  "тор": ["thor"],
  "халк": ["hulk"],
  "мстители": ["avengers"],
  "человек паук": ["spider man", "spider-man", "spiderman"],
  "паук": ["spider man", "spider-man"],
  "железный человек": ["iron man"],
  "железный": ["iron man"],
  "капитан америка": ["captain america"],
  "черная вдова": ["black widow"],
  "чёрная вдова": ["black widow"],
  "черная пантера": ["black panther"],
  "чёрная пантера": ["black panther"],
  "доктор стрэндж": ["doctor strange", "dr strange"],
  "доктор стрендж": ["doctor strange", "dr strange"],
  "стражи галактики": ["guardians of the galaxy"],
  "дэдпул": ["deadpool"],
  "дедпул": ["deadpool"],
  "росомаха": ["wolverine"],
  "люди икс": ["x men", "x-men"],
  "икс мен": ["x men", "x-men"],
  "бэтмен": ["batman"],
  "бетмен": ["batman"],
  "супермен": ["superman"],
  "джокер": ["joker"],
  "флэш": ["flash"],
  "флеш": ["flash"],
  "аквамен": ["aquaman"],
  "чудо женщина": ["wonder woman"],
  "гарри поттер": ["harry potter"],
  "поттер": ["harry potter", "potter"],
  "властелин колец": ["lord of the rings"],
  "хоббит": ["hobbit"],
  "звездные войны": ["star wars"],
  "звёздные войны": ["star wars"],
  "пираты карибского моря": ["pirates of the caribbean"],
  "форсаж": ["fast and furious", "fast furious"],
  "миссия невыполнима": ["mission impossible"],
  "терминатор": ["terminator"],
  "матрица": ["matrix"],
  "аватар": ["avatar"],
  "интерстеллар": ["interstellar"],
  "начало": ["inception"],
  "игра престолов": ["game of thrones"],
  "престолов": ["game of thrones"],
  "ходячие мертвецы": ["walking dead", "the walking dead"],
  "извне": ["from"],
  "во все тяжкие": ["breaking bad"],
  "лучше звоните солу": ["better call saul"],
  "очень странные дела": ["stranger things"],
  "пацаны": ["the boys"],
};

for (const [russian, aliases] of Object.entries({ ...SEARCH_ALIASES })) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeRawSearchText(alias);
    SEARCH_ALIASES[normalizedAlias] = Array.from(new Set([...(SEARCH_ALIASES[normalizedAlias] ?? []), russian]));
  }
}

function normalizeRawSearchText(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/&/g, " and ")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSearchQuery(query: string) {
  return normalizeRawSearchText(query);
}


export function normalizeSearchIntentQuery(query: string) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return "";

  let cleaned = ` ${normalized} `;
  for (const pattern of SEARCH_INTENT_PHRASE_PATTERNS) cleaned = cleaned.replace(pattern, " ");

  cleaned = cleaned
    .replace(/\b(?:hd|fullhd|fhd|uhd|4k)\s*(?:резка|rip|quality)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter((token) => {
    if (!token) return false;
    if (SEARCH_INTENT_STOP_WORDS.has(token)) return false;
    if (/^(?:19|20)\d{2}$/.test(token)) return true;
    return true;
  });

  const intent = tokens.join(" ").trim();
  return intent || normalized;
}

export function tokenizeSearchQuery(query: string) {
  return Array.from(new Set(normalizeSearchQuery(query).split(" ").filter((token) => token.length >= 2)));
}

export function transliterateSearchQuery(query: string) {
  return normalizeSearchQuery(query).split("").map((letter) => transliteration[letter] ?? letter).join("");
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

  // Реальные названия часто хранятся как “Человек-паук” / “Spider-Man”,
  // а пользователь пишет “человек паук” / “spider man”. Для Prisma contains/startsWith
  // это разные строки, поэтому добавляем формы с пробелом, дефисом и compact-вариант.
  if (normalized.includes(" ")) {
    addUnique(target, normalized.replace(/\s+/g, "-"));
    addUnique(target, normalized.replace(/\s+/g, ""));
  }
  if (normalized.includes("-")) {
    addUnique(target, normalized.replace(/-+/g, " "));
    addUnique(target, normalized.replace(/-+/g, ""));
  }
}

function addAliasVariants(target: string[], normalized: string) {
  for (const alias of SEARCH_ALIASES[normalized] ?? []) addQueryShapeVariants(target, alias);

  for (const token of tokenizeSearchQuery(normalized)) {
    for (const alias of SEARCH_ALIASES[token] ?? []) addQueryShapeVariants(target, alias);
  }

  // Важный autocomplete-case: пользователь ввёл “человек п”, “игра пр”,
  // “ходячие м”, но ещё не дописал точный алиас. Подтягиваем полный алиас
  // и его англ. варианты, иначе выдача забивается “Человек против...” и т.п.
  if (normalized.length >= 4) {
    for (const [aliasKey, aliases] of Object.entries(SEARCH_ALIASES)) {
      if (aliasKey.length >= 4 && aliasKey.startsWith(normalized)) {
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

  // Сохраняем исходную форму как слабую запасную ветку: это помогает редким названиям,
  // где слова вроде "сезон" или "серия" действительно являются частью тайтла.
  if (normalized !== intent) {
    addQueryShapeVariants(variants, normalized);
    addAliasVariants(variants, normalized);
  }

  return variants.slice(0, 32);
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
  const boundaryQueries = [
    ` ${normalized}`,
    `-${normalized}`,
    `: ${normalized}`,
    `. ${normalized}`,
    `, ${normalized}`,
    `«${normalized}`,
    `"${normalized}`,
    `(${normalized}`,
  ];

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
  const normalized = normalizeSearchQuery(value);
  const tokens = tokenizeSearchQuery(normalized).filter((token) => token.length >= 3);
  if (tokens.length < 2) return [];

  const fields: SearchTextField[] = ["titleRu", "titleOriginal", "slug"];
  return fields.map((field) => ({
    AND: tokens.map((token) => textFieldWhere(field, { contains: token, mode: "insensitive" })),
  }));
}

function idWhere(query: string): Prisma.MovieWhereInput[] {
  const normalized = normalizeSearchQuery(query);
  const compact = normalized.replace(/\s+/g, "");
  const where: Prisma.MovieWhereInput[] = [];
  if (/^tt\d{4,}$/i.test(compact)) where.push({ imdbId: { equals: compact, mode: "insensitive" } });
  if (/^\d{3,}$/.test(compact)) {
    where.push({ kinopoiskId: { equals: compact, mode: "insensitive" } });
    where.push({ tmdbId: { equals: compact, mode: "insensitive" } });
    const maybeVibixId = Number(compact);
    if (Number.isSafeInteger(maybeVibixId)) where.push({ vibixId: maybeVibixId });
  }
  if (/^(19|20)\d{2}$/.test(compact)) where.push({ year: Number(compact) });
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

export function buildSearchWhere(query: string): Prisma.MovieWhereInput {
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  const variants = buildSearchVariants(normalized);
  if (!variants.length) return {};
  const relaxedContains = !isShortSingleToken(intent);
  const OR = [
    ...idWhere(intent),
    ...(intent !== normalized ? idWhere(normalized) : []),
    ...variants.flatMap((variant) => [
      ...titleFieldWhere(variant, relaxedContains),
      ...titleTokenAndWhere(variant),
    ]),
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
  if (!text || !phrase) return false;
  return text === phrase || (text.startsWith(phrase) && hasBoundaryAfter(text, 0, phrase));
}

function isAllowedShortPrefix(token: string, word: string) {
  if (!word.startsWith(token)) return false;
  if (token.length >= 4) return true;
  return word.length <= token.length + SHORT_TOKEN_MAX_PREFIX_EXTRA;
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

  if (tokens.length) {
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
    if (matchedTokens === tokens.length) score += tokens.length >= 2 ? 28 : 12;
  }

  return score;
}

export function scoreSearchResult(movie: SearchMovie, query: string) {
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
    score += Math.max(0, scoreOneTextField(movie.titleRu, variant, variantTokens, 210, 165, 132) - aliasPenalty);
    score += Math.max(0, scoreOneTextField(movie.titleOriginal ?? "", variant, variantTokens, 185, 145, 112) - aliasPenalty);
    score += Math.max(0, scoreOneTextField(movie.slug, variant, variantTokens, 135, 105, 85) - aliasPenalty);
  }

  if (tokens.some((token) => token === String(movie.year))) score += 40;

  // Жанры/страны — только вторичный поиск. Они не должны обгонять совпадения по названию.
  if (intent.length >= 4) {
    const genreWords = movie.genres.flatMap((item) => splitWords(item.genre.name));
    if (tokens.some((token) => genreWords.includes(token))) score += 18;
    if (movie.country && phraseAtWordBoundary(normalizeSearchQuery(movie.country), intent)) score += 12;
  }

  // Защита от мусора типа “тор” внутри “доктор/торонто/история/шторм”.
  if (isShortSingleToken(intent) && score < 70) return 0;

  if (score <= 0) return 0;
  if (movie.vibixAvailable) score += 8;
  if (movie.posterUrl) score += 5;
  if (movie.isPublicVisible) score += 8;
  if (movie.isHomeEligible || movie.isPopularEligible || movie.isTopEligible) score += 5;
  score += popularityBoost(movie);
  return score;
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

function hasActiveSearchFilter(filters: SearchFilters): boolean {
  const country = normalizeCatalogCountry(filters.country ?? "all");
  return Boolean(
    (country !== "all" && country !== "main")
    || Object.values(ContentType).includes(filters.type as ContentType)
    || /^(19|20)\d{2}$/.test(filters.year ?? "")
    || filters.genre,
  );
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

  // Для длинных запросов можно добрать metadata-результаты, но они всё равно будут ниже title matches по score.
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

  return candidates
    .map((movie) => ({ movie, score: scoreSearchResult(movie, intent) }))
    .filter((item) => item.score >= 70)
    .sort((a, b) => b.score - a.score || popularityBoost(b.movie) - popularityBoost(a.movie) || (b.movie.year ?? 0) - (a.movie.year ?? 0))
    .slice(0, limit)
    .map((item) => item.movie);
}

export async function searchMovies(query: string, filters: SearchFilters = {}, limit = 48) {
  const normalized = normalizeSearchQuery(query);
  const intent = normalizeSearchIntentQuery(normalized);
  if (!intent) return [];

  const primary = await searchMoviesOnce(normalized, filters, limit);
  if (primary.length || !hasActiveSearchFilter(filters)) return primary;

  // Пользователь часто приходит в поиск с уже выбранной страной/типом из фильтров.
  // Если точное название есть в базе, не надо показывать “ничего не найдено” только из-за старого фильтра.
  const countryRelaxed = await searchMoviesOnce(normalized, { ...filters, country: "all" }, limit);
  if (countryRelaxed.length) return countryRelaxed;

  return searchMoviesOnce(normalized, { country: "all" }, limit);
}
