import fs from "node:fs/promises";
import path from "node:path";
import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildFranchiseWhere, getFranchiseConfig } from "@/lib/seo/franchise-orders";

export type SeoIntent = "BASE" | "YEAR" | "FILMY_PRO" | "MULTIKI_PRO" | "FRANCHISE" | "EXCLUDED" | "UNKNOWN";

const EXCLUDED_PATTERNS = [
  /\bпорно\b/i,
  /\bсекс\b/i,
  /\bsex\b/i,
  /\bxxx\b/i,
  /\bэротик/i,
  /\bторрент/i,
  /\btorrent/i,
  /\bскачать\b/i,
  /\bdownload\b/i,
  /\b18\+\b/i,
];

const GENERATED_LANDING_TYPES = [
  "BASE",
  "COLLECTION",
  "CARTOON_COLLECTION",
  "CARTOON_YEAR",
  "SERIES_YEAR",
  "ANIME_YEAR",
  "MOVIE_YEAR",
  "FRANCHISE",
  "FRANCHISE_ORDER",
];

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

type WordstatRow = { query: string; impressions: number };

const INT4_MAX = 2_000_000_000;

function int4(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), INT4_MAX);
}


export function normalizeSeoQuery(query: string) {
  return query
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[«»“”„"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyRu(value: string) {
  return normalizeSeoQuery(value)
    .split("")
    .map((char) => CYR_TO_LAT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function detectSeoIntent(query: string): SeoIntent {
  const normalized = normalizeSeoQuery(query);
  if (!normalized) return "UNKNOWN";
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized))) return "EXCLUDED";
  if (/марвел|marvel|мстители|avengers|человек паук|человек-паук|spider/.test(normalized)) return "FRANCHISE";
  if (/мультик|мультфильм|мультфильмы|мультики/.test(normalized) && /\bпро\b/.test(normalized)) return "MULTIKI_PRO";
  if (/фильм|фильмы|кино|сериал/.test(normalized) && /\bпро\b/.test(normalized)) return "FILMY_PRO";
  if (/\b(20[0-3][0-9]|19[0-9]{2})\b/.test(normalized) && /фильм|кино|мультик|мультфильм|сериал|аниме/.test(normalized)) return "YEAR";
  if (/смотреть|онлайн|бесплатно|качество|новинки|лучшие|топ|фильмы|фильм|кино|сериалы|мультики|мультфильмы|аниме/.test(normalized)) return "BASE";
  return "UNKNOWN";
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ";" && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

function parseImpressions(value: string) {
  const number = Number(String(value ?? "").replace(/[^0-9]+/g, ""));
  return int4(Number.isFinite(number) ? number : 0);
}

export function parseWordstatCsv(text: string): WordstatRow[] {
  const rows: WordstatRow[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const query = String(cells[0] ?? "").trim();
    const impressions = parseImpressions(String(cells[1] ?? ""));

    if (!query || !impressions) continue;
    if (/число запросов|запросы со словами|топ частотных запросов/i.test(query)) continue;
    if (/^[0-9\s]+$/.test(query)) continue;

    rows.push({ query, impressions });
  }

  return rows;
}

function dedupeRows(rows: WordstatRow[]) {
  const map = new Map<string, WordstatRow & { normalizedQuery: string }>();

  for (const row of rows) {
    const normalizedQuery = normalizeSeoQuery(row.query);
    if (!normalizedQuery) continue;
    const previous = map.get(normalizedQuery);
    if (!previous || row.impressions > previous.impressions) {
      map.set(normalizedQuery, { ...row, normalizedQuery });
    }
  }

  return [...map.values()].sort((a, b) => b.impressions - a.impressions);
}

function afterPro(query: string) {
  const normalized = normalizeSeoQuery(query);
  const match = normalized.match(/\bпро\s+(.+)$/);
  if (!match) return null;
  return match[1]
    .replace(/\b(смотреть|онлайн|бесплатно|в хорошем качестве|фильмы|фильм|кино|мультики|мультик|мультфильмы|мультфильм|сериалы|сериал)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yearFromQuery(query: string) {
  const match = normalizeSeoQuery(query).match(/\b(20[0-3][0-9]|19[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

export function buildClusterForQuery(query: string) {
  const normalized = normalizeSeoQuery(query);
  const intent = detectSeoIntent(normalized);
  if (intent === "EXCLUDED" || intent === "UNKNOWN") return null;

  if (intent === "FILMY_PRO") {
    const topic = afterPro(normalized);
    if (!topic || topic.length < 3) return null;
    const slug = `filmy-pro-${slugifyRu(topic)}`;
    return { key: slug, targetSlug: slug, intent, targetType: "COLLECTION", title: `Фильмы про ${topic}`, mainQuery: `фильмы про ${topic}` };
  }

  if (intent === "MULTIKI_PRO") {
    const topic = afterPro(normalized);
    if (!topic || topic.length < 3) return null;
    const slug = `multiki-pro-${slugifyRu(topic)}`;
    return { key: slug, targetSlug: slug, intent, targetType: "CARTOON_COLLECTION", title: `Мультики про ${topic}`, mainQuery: `мультики про ${topic}` };
  }

  if (intent === "YEAR") {
    const year = yearFromQuery(normalized);
    if (!year) return null;
    const isCartoon = /мульт|мультик/.test(normalized);
    const isSeries = /сериал/.test(normalized);
    const isAnime = /аниме/.test(normalized);
    const prefix = isCartoon ? "multfilmy" : isSeries ? "serialy" : isAnime ? "anime" : "filmy";
    const titlePrefix = isCartoon ? "Мультфильмы" : isSeries ? "Сериалы" : isAnime ? "Аниме" : "Фильмы";
    const slug = `${prefix}-${year}`;
    return { key: slug, targetSlug: slug, intent, targetType: isCartoon ? "CARTOON_YEAR" : isSeries ? "SERIES_YEAR" : isAnime ? "ANIME_YEAR" : "MOVIE_YEAR", title: `${titlePrefix} ${year}`, mainQuery: `${titlePrefix.toLowerCase()} ${year}` };
  }

  if (intent === "FRANCHISE") {
    const slug = /марвел|marvel|мстители|avengers/.test(normalized) ? "filmy-marvel-po-poryadku" : "filmy-franshizy";
    const config = getFranchiseConfig(slug);
    const title = config?.h1 ?? (slug === "filmy-marvel-po-poryadku" ? "Фильмы Marvel по порядку" : "Популярные кинофраншизы");
    return { key: slug, targetSlug: slug, intent, targetType: config ? "FRANCHISE_ORDER" : "FRANCHISE", title, mainQuery: title.toLowerCase() };
  }

  const slug = /мульт|мультик/.test(normalized) ? "multfilmy-smotret-online" : /сериал/.test(normalized) ? "serialy-smotret-online" : /аниме/.test(normalized) ? "anime-smotret-online" : "filmy-smotret-online";
  const title = slug.startsWith("mult") ? "Мультфильмы смотреть онлайн" : slug.startsWith("serial") ? "Сериалы смотреть онлайн" : slug.startsWith("anime") ? "Аниме смотреть онлайн" : "Фильмы смотреть онлайн";
  return { key: slug, targetSlug: slug, intent: "BASE" as const, targetType: "BASE", title, mainQuery: title.toLowerCase() };
}

export function buildLandingText(cluster: { title: string; mainQuery: string; targetSlug: string; targetType: string }, variants: string[], totalDemand: number) {
  const config = getFranchiseConfig(cluster.targetSlug);
  if (config) {
    return {
      title: config.title,
      h1: config.h1,
      description: config.description,
      introText: config.intro,
      keywordVariants: variants.slice(0, 40),
    };
  }

  const title = `${cluster.title} смотреть онлайн — REDFILM`;
  const h1 = cluster.title;
  const description = `${cluster.title}: подборка REDFILM с фильмами, сериалами и мультфильмами по теме. Смотрите онлайн в хорошем качестве.`;
  const introText = landingIntroForCluster(cluster);
  return { title, h1, description, introText, keywordVariants: variants.slice(0, 40) };
}

function landingIntroForCluster(cluster: { title: string; mainQuery: string; targetSlug: string; targetType: string }) {
  const title = cluster.title.toLowerCase();
  if (cluster.targetType === "BASE") {
    if (cluster.targetSlug.startsWith("serial")) return "В разделе собраны сериалы REDFILM с плеером, постерами, рейтингами и удобной навигацией по жанрам, годам и подборкам.";
    if (cluster.targetSlug.startsWith("mult")) return "В разделе собраны мультфильмы REDFILM: новинки, семейные истории, приключения и популярные анимационные фильмы для просмотра онлайн.";
    if (cluster.targetSlug.startsWith("anime")) return "В разделе собраны аниме REDFILM с доступным плеером, постерами, рейтингами и быстрым переходом к похожим тайтлам.";
    return "В разделе собраны фильмы REDFILM для онлайн-просмотра: новинки, популярные картины, жанровые подборки и проверенные хиты с рейтингами.";
  }
  if (cluster.targetType === "CARTOON_COLLECTION") {
    return `Подборка для тех, кто ищет ${title}. Здесь собраны мультфильмы и анимационные истории из каталога REDFILM, которые подходят по теме, названию, описанию и жанрам.`;
  }
  if (cluster.targetType.endsWith("YEAR")) {
    return `Собрали доступные на REDFILM тайтлы за выбранный год: новинки, популярные фильмы, сериалы и анимацию с постерами, рейтингами и быстрым переходом к просмотру.`;
  }
  return `Подборка REDFILM по теме «${title}»: фильмы и сериалы с плеером, постерами, рейтингами и ссылками на похожие страницы.`;
}

export function whereForSeoLanding(filter: unknown): Prisma.MovieWhereInput {
  const value = typeof filter === "object" && filter ? filter as Record<string, unknown> : {};
  const targetType = String(value.targetType ?? "COLLECTION");
  const slug = String(value.slug ?? value.targetSlug ?? "").trim();
  const franchiseWhere = targetType === "FRANCHISE_ORDER" || targetType === "FRANCHISE" ? buildFranchiseWhere(slug) : null;
  if (franchiseWhere) return franchiseWhere;
  const topic = String(value.topic ?? "").trim();
  const year = Number(value.year);
  const words = topic ? topic.split(/\s+/).filter((word) => word.length >= 3).slice(0, 4) : [];
  const textWhere = words.length ? { OR: words.flatMap((word) => [
    { titleRu: { contains: word, mode: "insensitive" as const } },
    { titleOriginal: { contains: word, mode: "insensitive" as const } },
    { description: { contains: word, mode: "insensitive" as const } },
    { genres: { some: { genre: { name: { contains: word, mode: "insensitive" as const } } } } },
  ]) } : {};
  const yearWhere = Number.isFinite(year) && year > 1900 ? { year } : {};
  const typeWhere: Prisma.MovieWhereInput = targetType === "CARTOON_COLLECTION" || targetType === "CARTOON_YEAR" ? { type: ContentType.CARTOON } : targetType === "SERIES_YEAR" ? { type: ContentType.SERIES } : targetType === "ANIME_YEAR" ? { type: ContentType.ANIME } : targetType === "MOVIE_YEAR" ? { type: ContentType.MOVIE } : {};
  return { AND: [typeWhere, yearWhere, textWhere].filter((item) => Object.keys(item).length) };
}

function filterForCluster(cluster: ReturnType<typeof buildClusterForQuery>) {
  if (!cluster) return undefined;
  const topic = cluster.intent === "FILMY_PRO" || cluster.intent === "MULTIKI_PRO" ? cluster.mainQuery.replace(/^фильмы про |^мультики про /, "") : undefined;
  const year = cluster.intent === "YEAR" ? yearFromQuery(cluster.mainQuery) : undefined;
  return { targetType: cluster.targetType, targetSlug: cluster.targetSlug, topic, year };
}

async function resetGeneratedSeoPages() {
  await prisma.seoLandingPage.deleteMany({ where: { type: { in: GENERATED_LANDING_TYPES } } });
  await prisma.seoCluster.deleteMany({});
}

export async function resetWordstatSeoEngine() {
  await resetGeneratedSeoPages();
  await prisma.seoKeyword.deleteMany({ where: { source: { startsWith: "wordstat" } } });
}

export async function importWordstatRows(rowsInput: WordstatRow[], source = "wordstat", options?: { replace?: boolean }) {
  if (options?.replace) {
    await resetWordstatSeoEngine();
  }

  const rows = dedupeRows(rowsInput);
  let imported = 0;
  let excluded = 0;
  let active = 0;
  let needsReview = 0;
  const clusterMap = new Map<string, { cluster: NonNullable<ReturnType<typeof buildClusterForQuery>>; totalDemand: number; variants: string[] }>();

  for (const row of rows) {
    const normalizedQuery = row.normalizedQuery ?? normalizeSeoQuery(row.query);
    const intent = detectSeoIntent(normalizedQuery);
    const cluster = buildClusterForQuery(normalizedQuery);
    const status = intent === "EXCLUDED" ? "EXCLUDED" : cluster ? "ACTIVE" : "NEEDS_REVIEW";

    if (status === "EXCLUDED") excluded++;
    if (status === "ACTIVE") active++;
    if (status === "NEEDS_REVIEW") needsReview++;

    await prisma.seoKeyword.upsert({
      where: { normalizedQuery_source: { normalizedQuery, source } },
      update: { query: row.query, impressions: row.impressions, intent, status, clusterKey: cluster?.key },
      create: { query: row.query, normalizedQuery, impressions: row.impressions, source, intent, status, clusterKey: cluster?.key },
    });
    imported++;

    if (cluster) {
      const prev = clusterMap.get(cluster.key) ?? { cluster, totalDemand: 0, variants: [] };
      prev.totalDemand = int4(prev.totalDemand + row.impressions);
      if (!prev.variants.includes(normalizedQuery)) prev.variants.push(normalizedQuery);
      clusterMap.set(cluster.key, prev);
    }
  }

  let clusters = 0;
  let pages = 0;
  for (const item of clusterMap.values()) {
    const totalDemand = int4(item.totalDemand);
    const landing = buildLandingText(item.cluster, item.variants, totalDemand);
    const filterJson = filterForCluster(item.cluster) ?? {};
    await prisma.seoCluster.upsert({
      where: { key: item.cluster.key },
      update: { title: item.cluster.title, intent: item.cluster.intent, mainQuery: item.cluster.mainQuery, totalDemand, targetType: item.cluster.targetType, targetSlug: item.cluster.targetSlug, variantsJson: item.variants, status: "ACTIVE" },
      create: { key: item.cluster.key, title: item.cluster.title, intent: item.cluster.intent, mainQuery: item.cluster.mainQuery, totalDemand, targetType: item.cluster.targetType, targetSlug: item.cluster.targetSlug, variantsJson: item.variants, status: "ACTIVE" },
    });
    clusters++;
    await prisma.seoLandingPage.upsert({
      where: { slug: item.cluster.targetSlug },
      update: { ...landing, type: item.cluster.targetType, mainQuery: item.cluster.mainQuery, totalDemand, filterJson: filterJson as Prisma.InputJsonValue, isIndexable: true, sitemapIncluded: true, status: "ACTIVE" },
      create: { slug: item.cluster.targetSlug, type: item.cluster.targetType, ...landing, mainQuery: item.cluster.mainQuery, totalDemand, filterJson: filterJson as Prisma.InputJsonValue, minItems: item.cluster.intent === "BASE" ? 12 : 6, status: "ACTIVE", isIndexable: true, sitemapIncluded: true },
    });
    pages++;
  }

  return { rows: rowsInput.length, uniqueRows: rows.length, imported, active, excluded, needsReview, clusters, pages };
}

export async function importWordstatKeywords(text: string, source = "wordstat", options?: { replace?: boolean }) {
  return importWordstatRows(parseWordstatCsv(text), source, options);
}

export async function importEmbeddedWordstatFiles(options?: { replace?: boolean }) {
  const dir = path.join(process.cwd(), "src", "data", "wordstat");
  const files = (await fs.readdir(dir).catch(() => [])).filter((file) => file.endsWith(".csv")).sort();
  const rows: WordstatRow[] = [];

  for (const file of files) {
    const text = await fs.readFile(path.join(dir, file), "utf8");
    rows.push(...parseWordstatCsv(text));
  }

  const result = await importWordstatRows(rows, "wordstat", { replace: options?.replace ?? true });
  return { files: files.length, ...result };
}

export async function getSeoAdminStats() {
  const [keywords, activeKeywords, excludedKeywords, reviewKeywords, clusters, pages, indexablePages] = await Promise.all([
    prisma.seoKeyword.count().catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "EXCLUDED" } }).catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "NEEDS_REVIEW" } }).catch(() => 0),
    prisma.seoCluster.count().catch(() => 0),
    prisma.seoLandingPage.count().catch(() => 0),
    prisma.seoLandingPage.count({ where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true } }).catch(() => 0),
  ]);
  return { keywords, activeKeywords, excludedKeywords, reviewKeywords, clusters, pages, indexablePages };
}
