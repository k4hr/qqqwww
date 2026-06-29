import type { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere, vibixWatchMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { likePath, personPath, similarPath, watchPath } from "@/lib/seo-links";
import { normalizeSeoQuery, slugifyRu } from "@/lib/seo/keyword-engine";
import { detectWarTopic } from "@/lib/seo/topic-intents";
import { isPublicPersonName } from "@/lib/person-quality";

export type SeoOpportunityIntent =
  | "WATCH_TITLE"
  | "SEASON"
  | "SIMILAR"
  | "LIKE_AFTER"
  | "PERSON"
  | "GENRE_YEAR"
  | "COUNTRY_TYPE"
  | "ANIME_TOPIC"
  | "WAR_TOPIC"
  | "FRANCHISE_ORDER"
  | "COLLECTION"
  | "BASE"
  | "EXCLUDED"
  | "UNKNOWN";

export type SeoOpportunityStatus =
  | "READY"
  | "NEEDS_MOVIE"
  | "NEEDS_VIBIX"
  | "NEEDS_SIMILARITY"
  | "NEEDS_SEASON_PAGE"
  | "NEEDS_PERSON_PAGE"
  | "NEEDS_COLLECTION"
  | "THIN"
  | "EXCLUDED"
  | "REVIEW";

export type SeoOpportunity = {
  query: string;
  normalizedQuery: string;
  impressions: number;
  intent: SeoOpportunityIntent;
  status: SeoOpportunityStatus;
  targetUrl: string | null;
  entityTitle: string | null;
  problem: string;
  priority: number;
  seasonNumber?: number | null;
  movieId?: string | null;
  personId?: string | null;
  similarityCount?: number;
};

export type SeoOpportunityReport = {
  checked: number;
  totalDemand: number;
  readyDemand: number;
  missingDemand: number;
  readyShare: number;
  byStatus: Array<{ status: SeoOpportunityStatus; count: number; demand: number }>;
  byIntent: Array<{ intent: SeoOpportunityIntent; count: number; demand: number }>;
  opportunities: SeoOpportunity[];
};

const SEARCH_WORDS = [
  "смотреть", "онлайн", "бесплатно", "бесплатный", "качество", "хорошем", "хороший", "hd", "fullhd", "1080", "720",
  "фильм", "фильмы", "кино", "сериал", "сериалы", "мультфильм", "мультфильмы", "мультик", "мультики", "аниме",
  "все", "серии", "серия", "подряд", "русский", "русские", "озвучка", "сезон", "сезона", "сезоны",
  "lordfilm", "лордфильм", "redfilm", "редфильм",
];

const COUNTRY_ALIASES: Array<{ pattern: RegExp; slug: string; title: string; type?: ContentType }> = [
  { pattern: /русск|росси/, slug: "russkie", title: "Русские" },
  { pattern: /турецк|турц/, slug: "tureckie", title: "Турецкие", type: "SERIES" as ContentType },
  { pattern: /корейск|дорам/, slug: "koreyskie", title: "Корейские" },
  { pattern: /индийск|индия/, slug: "indiyskie", title: "Индийские" },
  { pattern: /японск|япони/, slug: "yaponskie", title: "Японские" },
  { pattern: /американск|сша/, slug: "amerikanskie", title: "Американские" },
];

const FRANCHISE_ALIASES: Array<{ pattern: RegExp; slug: string; title: string }> = [
  { pattern: /марвел|marvel|мстител|avengers/, slug: "filmy-marvel-po-poryadku", title: "Фильмы Marvel по порядку" },
  { pattern: /гарри поттер|harry potter/, slug: "garri-potter-vse-chasti", title: "Гарри Поттер все части по порядку" },
  { pattern: /форсаж|fast furious/, slug: "forsazh-vse-chasti", title: "Форсаж все части по порядку" },
  { pattern: /властелин колец|lord of the rings|хоббит/, slug: "vlastelin-kolets-vse-chasti", title: "Властелин колец все части по порядку" },
  { pattern: /человек паук|человек-паук|spider/, slug: "chelovek-pauk-vse-chasti", title: "Человек-паук все части по порядку" },
  { pattern: /пила\b|saw\b/, slug: "pila-vse-chasti", title: "Пила все части по порядку" },
  { pattern: /терминатор|terminator/, slug: "terminator-vse-chasti", title: "Терминатор все части по порядку" },
  { pattern: /чужой|alien/, slug: "chuzhoy-vse-chasti", title: "Чужой все части по порядку" },
];

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

function titleCaseRu(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? `${cleaned[0].toLocaleUpperCase("ru-RU")}${cleaned.slice(1)}` : cleaned;
}

function cleanEntityTitle(query: string) {
  let value = normalizeSeoQuery(query);
  value = value
    .replace(/\b(что посмотреть если понравил[ао]сь?|что посмотреть после|после просмотра|похожие на|похожи[ей]* на|фильмы похожие на|сериалы похожие на)\b/g, " ")
    .replace(/\b(смотреть|онлайн|бесплатно|в хорошем качестве|хорошем качестве|hd|fullhd|1080p?|720p?)\b/g, " ")
    .replace(/\b(все серии|все сезоны|серии подряд|подряд)\b/g, " ")
    .replace(/\b\d+\s*(сезон|сезона)\b/g, " ")
    .replace(/\b(фильм|фильмы|кино|сериал|сериалы|мультфильм|мультфильмы|аниме)\b/g, " ")
    .replace(/\b(лордфильм|lordfilm|редфильм|redfilm)\b/g, " ")
    .replace(/\b(20[0-3][0-9]|19[0-9]{2})\b/g, " ")
    .replace(/[^a-zа-я0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = value.split(" ").filter((word) => word.length > 1 && !SEARCH_WORDS.includes(word));
  return words.join(" ").trim();
}

function seasonNumber(query: string) {
  const normalized = normalizeSeoQuery(query);
  const match = normalized.match(/\b([1-9]|1[0-9]|2[0-5])\s*(?:й|-й)?\s*(сезон|сезона)\b/);
  return match ? Number(match[1]) : null;
}

export function detectSeoOpportunityIntent(query: string): SeoOpportunityIntent {
  const normalized = normalizeSeoQuery(query);
  if (!normalized) return "UNKNOWN";
  if (/\b(порно|sex|xxx|торрент|torrent|скачать|download)\b/i.test(normalized)) return "EXCLUDED";
  if (detectWarTopic(normalized)) return "WAR_TOPIC";
  if (seasonNumber(normalized)) return "SEASON";
  if (/что посмотреть|после просмотра|если понравил/.test(normalized)) return "LIKE_AFTER";
  if (/похожи[ей]* на|похожие на|фильмы похожие|сериалы похожие/.test(normalized)) return "SIMILAR";
  if (/фильмы с |сериалы с |кино с |с участием/.test(normalized)) return "PERSON";
  if (FRANCHISE_ALIASES.some((item) => item.pattern.test(normalized)) && /порядк|все части|хронолог|очеред/.test(normalized)) return "FRANCHISE_ORDER";
  if (/аниме/.test(normalized) && /про |исекай|магия|романтик|школ|демон|вампир|спорт/.test(normalized)) return "ANIME_TOPIC";
  if (/\b(20[0-3][0-9]|19[0-9]{2})\b/.test(normalized) && /боевик|комеди|ужас|триллер|драм|фантаст|мелодрам|детектив|аниме|сериал/.test(normalized)) return "GENRE_YEAR";
  if (COUNTRY_ALIASES.some((item) => item.pattern.test(normalized)) && /фильм|сериал|аниме|дорам/.test(normalized)) return "COUNTRY_TYPE";
  if (/смотреть|онлайн|фильм|сериал|мультфильм|аниме/.test(normalized) && cleanEntityTitle(normalized).length >= 3) return "WATCH_TITLE";
  if (/новинки|лучшие|топ|подборк|фильмы|сериалы|мультфильмы|аниме/.test(normalized)) return "COLLECTION";
  return "UNKNOWN";
}

export function targetCollectionForQuery(query: string) {
  const normalized = normalizeSeoQuery(query);
  const warTopic = detectWarTopic(normalized);
  if (warTopic) return { slug: warTopic.targetSlug, title: warTopic.title };
  const year = normalized.match(/\b(20[0-3][0-9]|19[0-9]{2})\b/)?.[1];
  const franchise = FRANCHISE_ALIASES.find((item) => item.pattern.test(normalized));
  if (franchise) return { slug: franchise.slug, title: franchise.title };

  const country = COUNTRY_ALIASES.find((item) => item.pattern.test(normalized));
  if (country) {
    const type = /сериал|дорам/.test(normalized) ? "serialy" : /аниме/.test(normalized) ? "anime" : "filmy";
    const titleType = type === "serialy" ? "сериалы" : type === "anime" ? "аниме" : "фильмы";
    const slug = `${country.slug}-${type}${year ? `-${year}` : ""}`;
    return { slug, title: `${country.title} ${titleType}${year ? ` ${year}` : ""}` };
  }

  const genre = normalized.match(/\b(боевик[иов]*|комеди[яи]*|ужас[ыов]*|триллер[ыов]*|драм[аы]*|фантастик[аи]*|мелодрам[аы]*|детектив[ыов]*|криминал|приключени[яй]*)\b/)?.[1];
  if (genre && year) {
    const normalizedGenre = genre.replace(/ы$|ов$|и$/g, "");
    const slug = `${slugifyRu(normalizedGenre)}-${year}`;
    return { slug, title: `${titleCaseRu(normalizedGenre)} ${year}` };
  }

  if (/аниме/.test(normalized)) {
    const topic = cleanEntityTitle(normalized).replace(/^аниме\s+/, "") || "popularnoe";
    const slug = `anime-${slugifyRu(topic)}${year ? `-${year}` : ""}`;
    return { slug, title: `Аниме ${topic}${year ? ` ${year}` : ""}` };
  }

  return null;
}

async function matchMovieByQuery(query: string, type?: ContentType) {
  const entity = cleanEntityTitle(query);
  if (!entity || entity.length < 3) return null;
  const words = entity.split(" ").filter((word) => word.length >= 3).slice(0, 5);
  if (!words.length) return null;

  const strictAnd: Prisma.MovieWhereInput[] = [];
  if (type) strictAnd.push({ type });
  strictAnd.push({
    OR: [
      { titleRu: { contains: entity, mode: "insensitive" as const } },
      { titleOriginal: { contains: entity, mode: "insensitive" as const } },
      { slug: { contains: slugifyRu(entity), mode: "insensitive" as const } },
    ],
  });

  const strictWhere: Prisma.MovieWhereInput = { AND: strictAnd };

  const strict = await prisma.movie.findFirst({
    where: strictWhere,
    orderBy: [{ isPublicVisible: "desc" }, { vibixAvailable: "desc" }, { popularScore: "desc" }, { kpRating: "desc" }],
    select: movieSelect,
  }).catch(() => null);
  if (strict) return strict;

  const looseAnd: Prisma.MovieWhereInput[] = [];
  if (type) looseAnd.push({ type });
  for (const word of words) {
    looseAnd.push({
      OR: [
        { titleRu: { contains: word, mode: "insensitive" as const } },
        { titleOriginal: { contains: word, mode: "insensitive" as const } },
        { slug: { contains: slugifyRu(word), mode: "insensitive" as const } },
      ],
    });
  }

  const loose = await prisma.movie.findMany({
    where: { AND: looseAnd },
    orderBy: [{ isPublicVisible: "desc" }, { vibixAvailable: "desc" }, { popularScore: "desc" }, { kpRating: "desc" }],
    select: movieSelect,
    take: 8,
  }).catch(() => []);

  return loose.find((movie) => normalizeSeoQuery(movie.titleRu).includes(entity) || entity.includes(normalizeSeoQuery(movie.titleRu))) ?? loose[0] ?? null;
}

const movieSelect = {
  id: true,
  slug: true,
  titleRu: true,
  titleOriginal: true,
  year: true,
  type: true,
  vibixAvailable: true,
  vibixIframeUrl: true,
  vibixEmbedCode: true,
  isPublished: true,
  isPublicVisible: true,
  isCatalogAllowed: true,
  vibixSeasonCount: true,
  posterUrl: true,
} satisfies Prisma.MovieSelect;

type MatchedMovie = Prisma.MovieGetPayload<{ select: typeof movieSelect }>;

function hasWatch(movie: MatchedMovie | null) {
  return Boolean(movie?.isPublished && movie?.vibixAvailable && (movie.vibixIframeUrl || movie.vibixEmbedCode || movie.slug));
}

async function similarityCount(movieId: string) {
  return prisma.movieSimilarity.count({ where: { sourceMovieId: movieId, score: { gte: 140 } } }).catch(() => 0);
}

async function matchPerson(query: string) {
  const entity = cleanEntityTitle(query.replace(/\b(фильмы с|сериалы с|кино с|с участием)\b/g, " "));
  if (!entity || entity.length < 3) return null;
  const token = entity.split(" ").find((word) => word.length >= 4) ?? entity;
  const people = await prisma.person.findMany({
    where: { OR: [{ nameRu: { contains: token, mode: "insensitive" as const } }, { nameOriginal: { contains: token, mode: "insensitive" as const } }] },
    select: { id: true, nameRu: true, nameOriginal: true },
    take: 20,
  }).catch(() => []);
  return people.find((person) => isPublicPersonName(person.nameRu) && normalizeSeoQuery(person.nameRu).includes(entity)) ?? people.find((person) => isPublicPersonName(person.nameRu)) ?? null;
}

async function publicPersonMovieCount(personId: string) {
  return prisma.movie.count({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { cast: { some: { personId } } }] } }).catch(() => 0);
}

function opportunity(status: SeoOpportunityStatus, input: Omit<SeoOpportunity, "status" | "priority"> & { priorityBoost?: number }): SeoOpportunity {
  const statusBoost: Record<SeoOpportunityStatus, number> = {
    READY: 0,
    NEEDS_MOVIE: 50,
    NEEDS_VIBIX: 45,
    NEEDS_SIMILARITY: 35,
    NEEDS_SEASON_PAGE: 40,
    NEEDS_PERSON_PAGE: 25,
    NEEDS_COLLECTION: 30,
    THIN: 15,
    EXCLUDED: -100,
    REVIEW: 10,
  };
  return { ...input, status, priority: Math.max(0, input.impressions + statusBoost[status] * 10_000 + (input.priorityBoost ?? 0)) };
}

export async function analyzeSeoKeyword(queryRow: { query: string; normalizedQuery: string; impressions: number }): Promise<SeoOpportunity> {
  const intent = detectSeoOpportunityIntent(queryRow.normalizedQuery);
  const base = { query: queryRow.query, normalizedQuery: queryRow.normalizedQuery, impressions: queryRow.impressions, intent, targetUrl: null, entityTitle: null, problem: "", movieId: null, personId: null };

  if (intent === "EXCLUDED") return opportunity("EXCLUDED", { ...base, problem: "Запрос исключён: adult/download/torrent." });

  if (intent === "SEASON") {
    const season = seasonNumber(queryRow.normalizedQuery);
    const movie = await matchMovieByQuery(queryRow.normalizedQuery, "SERIES" as ContentType);
    if (!movie) return opportunity("NEEDS_MOVIE", { ...base, seasonNumber: season, problem: "Сезонный запрос, но сериал не найден в базе REDFILM." });
    if (!hasWatch(movie)) return opportunity("NEEDS_VIBIX", { ...base, movieId: movie.id, entityTitle: movie.titleRu, seasonNumber: season, targetUrl: watchPath(movie), problem: "Сериал найден, но нет рабочего Vibix/watch-доступа." });
    const maxSeason = movie.vibixSeasonCount || 0;
    const targetUrl = season ? `/season/${slugifyRu(movie.titleRu)}-${season}-sezon` : watchPath(movie);
    const ready = !season || maxSeason === 0 || season <= maxSeason;
    return opportunity(ready ? "READY" : "NEEDS_SEASON_PAGE", { ...base, movieId: movie.id, entityTitle: movie.titleRu, seasonNumber: season, targetUrl, problem: ready ? "Сезонная посадочная готова: сериал найден, watch доступен." : `В базе указано сезонов: ${maxSeason}, запрос на сезон ${season}. Нужно проверить Vibix seasons.` });
  }

  if (intent === "SIMILAR" || intent === "LIKE_AFTER") {
    const movie = await matchMovieByQuery(queryRow.normalizedQuery);
    if (!movie) return opportunity("NEEDS_MOVIE", { ...base, problem: "Запрос на похожие/что посмотреть, но исходный тайтл не найден." });
    if (!hasWatch(movie)) return opportunity("NEEDS_VIBIX", { ...base, movieId: movie.id, entityTitle: movie.titleRu, targetUrl: watchPath(movie), problem: "Исходный тайтл найден, но нет рабочего плеера." });
    const count = await similarityCount(movie.id);
    const targetUrl = intent === "LIKE_AFTER" ? likePath(movie) : similarPath(movie);
    return opportunity(count >= 6 ? "READY" : "NEEDS_SIMILARITY", { ...base, movieId: movie.id, entityTitle: movie.titleRu, targetUrl, similarityCount: count, problem: count >= 6 ? "Страница похожих готова и может закрывать запрос." : `Похожих связей мало: ${count}. Нужно пересчитать similarity.` });
  }

  if (intent === "PERSON") {
    const person = await matchPerson(queryRow.normalizedQuery);
    if (!person) return opportunity("NEEDS_PERSON_PAGE", { ...base, problem: "Запрос по актёру, но персона не найдена в базе." });
    const count = await publicPersonMovieCount(person.id);
    return opportunity(count >= 3 ? "READY" : "THIN", { ...base, personId: person.id, entityTitle: person.nameRu, targetUrl: personPath(person.nameRu), problem: count >= 3 ? `Есть ${count} публичных тайтлов с персоной.` : `Мало публичных тайтлов с персоной: ${count}.` });
  }

  const collection = targetCollectionForQuery(queryRow.normalizedQuery);
  if (collection || intent === "WAR_TOPIC" || intent === "GENRE_YEAR" || intent === "COUNTRY_TYPE" || intent === "ANIME_TOPIC" || intent === "FRANCHISE_ORDER" || intent === "COLLECTION") {
    const target = collection ?? { slug: slugifyRu(cleanEntityTitle(queryRow.normalizedQuery) || queryRow.normalizedQuery), title: titleCaseRu(cleanEntityTitle(queryRow.normalizedQuery) || queryRow.query) };
    const landing = await prisma.seoLandingPage.findUnique({ where: { slug: target.slug }, select: { status: true, isIndexable: true, sitemapIncluded: true, type: true } }).catch(() => null);
    return opportunity(landing?.status === "ACTIVE" && landing.isIndexable ? "READY" : "NEEDS_COLLECTION", { ...base, entityTitle: target.title, targetUrl: `/collections/${target.slug}`, problem: landing ? `Страница есть, но статус ${landing.status}.` : "Нужно создать/усилить SEO-подборку под этот запрос." });
  }

  if (intent === "WATCH_TITLE") {
    const movie = await matchMovieByQuery(queryRow.normalizedQuery);
    if (!movie) return opportunity("NEEDS_MOVIE", { ...base, problem: "Запрос похож на конкретный тайтл, но фильм/сериал не найден." });
    if (!hasWatch(movie)) return opportunity("NEEDS_VIBIX", { ...base, movieId: movie.id, entityTitle: movie.titleRu, targetUrl: watchPath(movie), problem: "Тайтл найден, но Vibix/watch не готов." });
    const count = await similarityCount(movie.id);
    return opportunity(count >= 4 ? "READY" : "NEEDS_SIMILARITY", { ...base, movieId: movie.id, entityTitle: movie.titleRu, targetUrl: watchPath(movie), similarityCount: count, problem: count >= 4 ? "Watch-страница готова, плеер и базовая перелинковка есть." : `Watch готов, но похожих мало: ${count}.` });
  }

  return opportunity("REVIEW", { ...base, problem: "Интент не распознан точно. Нужна ручная проверка или новый шаблон." });
}

export async function getSeoOpportunityReport(limit = 160): Promise<SeoOpportunityReport> {
  const keywords = await prisma.seoKeyword.findMany({
    where: { status: { in: ["ACTIVE", "NEEDS_REVIEW"] } },
    select: { query: true, normalizedQuery: true, impressions: true },
    orderBy: [{ impressions: "desc" }, { updatedAt: "desc" }],
    take: Math.max(10, Math.min(limit, 500)),
  }).catch(() => []);

  const opportunities: SeoOpportunity[] = [];
  for (const keyword of keywords) opportunities.push(await analyzeSeoKeyword(keyword));
  opportunities.sort((a, b) => b.priority - a.priority);

  const totalDemand = sum(opportunities.map((item) => item.impressions));
  const readyDemand = sum(opportunities.filter((item) => item.status === "READY").map((item) => item.impressions));
  const missingDemand = totalDemand - readyDemand;

  const byStatusMap = new Map<SeoOpportunityStatus, { count: number; demand: number }>();
  const byIntentMap = new Map<SeoOpportunityIntent, { count: number; demand: number }>();
  for (const item of opportunities) {
    const status = byStatusMap.get(item.status) ?? { count: 0, demand: 0 };
    status.count += 1; status.demand += item.impressions; byStatusMap.set(item.status, status);
    const intent = byIntentMap.get(item.intent) ?? { count: 0, demand: 0 };
    intent.count += 1; intent.demand += item.impressions; byIntentMap.set(item.intent, intent);
  }

  return {
    checked: opportunities.length,
    totalDemand,
    readyDemand,
    missingDemand,
    readyShare: totalDemand > 0 ? Math.round((readyDemand / totalDemand) * 1000) / 10 : 0,
    byStatus: [...byStatusMap.entries()].map(([status, value]) => ({ status, ...value })).sort((a, b) => b.demand - a.demand),
    byIntent: [...byIntentMap.entries()].map(([intent, value]) => ({ intent, ...value })).sort((a, b) => b.demand - a.demand),
    opportunities,
  };
}
