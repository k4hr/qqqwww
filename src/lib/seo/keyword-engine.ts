import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
];

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

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
  if (/марвел|marvel|мстители|avengers|человек паук|spider/.test(normalized)) return "FRANCHISE";
  if (/мультик|мультфильм|мультфильмы|мультики/.test(normalized) && /\bпро\b/.test(normalized)) return "MULTIKI_PRO";
  if (/фильм|фильмы|кино|сериал/.test(normalized) && /\bпро\b/.test(normalized)) return "FILMY_PRO";
  if (/\b(20[0-3][0-9]|19[0-9]{2})\b/.test(normalized) && /фильм|кино|мультик|мультфильм|сериал|аниме/.test(normalized)) return "YEAR";
  if (/смотреть|онлайн|бесплатно|качество|новинки|лучшие|топ/.test(normalized)) return "BASE";
  return "UNKNOWN";
}

export function parseWordstatCsv(text: string) {
  const rows: Array<{ query: string; impressions: number }> = [];
  const cells = text
    .replace(/^\uFEFF/, "")
    .split(/[;\n\r]+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
  for (let index = 0; index < cells.length - 1; index += 2) {
    const query = cells[index]?.replace(/^"|"$/g, "").trim();
    const impressions = Number(String(cells[index + 1] ?? "").replace(/\D+/g, ""));
    if (!query || !Number.isFinite(impressions)) continue;
    if (/число запросов|запросы со словами|топ частотных/i.test(query)) continue;
    rows.push({ query, impressions });
  }
  return rows;
}

function afterPro(query: string) {
  const normalized = normalizeSeoQuery(query);
  const match = normalized.match(/\bпро\s+(.+)$/);
  if (!match) return null;
  return match[1]
    .replace(/\b(смотреть|онлайн|бесплатно|в хорошем качестве|фильмы|фильм|кино|мультики|мультик|мультфильмы|мультфильм)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yearFromQuery(query: string) {
  const match = normalizeSeoQuery(query).match(/\b(20[0-3][0-9]|19[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function titleCaseRu(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
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
    const title = slug === "filmy-marvel-po-poryadku" ? "Фильмы Marvel по порядку" : "Популярные кинофраншизы";
    return { key: slug, targetSlug: slug, intent, targetType: "FRANCHISE", title, mainQuery: title.toLowerCase() };
  }

  const slug = /мульт/.test(normalized) ? "multfilmy-smotret-online" : /сериал/.test(normalized) ? "serialy-smotret-online" : "filmy-smotret-online";
  const title = slug.startsWith("mult") ? "Мультфильмы смотреть онлайн" : slug.startsWith("serial") ? "Сериалы смотреть онлайн" : "Фильмы смотреть онлайн";
  return { key: slug, targetSlug: slug, intent: "BASE" as const, targetType: "BASE", title, mainQuery: title.toLowerCase() };
}

export function buildLandingText(cluster: { title: string; mainQuery: string; targetSlug: string; targetType: string }, variants: string[], totalDemand: number) {
  const title = `${cluster.title} смотреть онлайн — REDFILM`;
  const h1 = cluster.title;
  const description = `${cluster.title}: подборка доступных фильмов и сериалов REDFILM с описаниями, рейтингами и плеером. Смотрите онлайн в хорошем качестве.`;
  const introText = `Страница создана на основе поискового спроса Wordstat и каталога REDFILM. Здесь собраны доступные тайтлы по теме «${cluster.title.toLowerCase()}»: фильмы, сериалы, мультфильмы или аниме с плеером, постерами, рейтингами и внутренними ссылками. Суммарный спрос кластера: ${totalDemand.toLocaleString("ru-RU")}.`;
  return { title, h1, description, introText, keywordVariants: variants.slice(0, 40) };
}

export function whereForSeoLanding(filter: unknown): Prisma.MovieWhereInput {
  const value = typeof filter === "object" && filter ? filter as Record<string, unknown> : {};
  const targetType = String(value.targetType ?? "COLLECTION");
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
  return { targetType: cluster.targetType, topic, year };
}

export async function importWordstatKeywords(text: string, source = "wordstat") {
  const rows = parseWordstatCsv(text);
  let imported = 0;
  let excluded = 0;
  const clusterMap = new Map<string, { cluster: NonNullable<ReturnType<typeof buildClusterForQuery>>; totalDemand: number; variants: string[] }>();

  for (const row of rows) {
    const normalizedQuery = normalizeSeoQuery(row.query);
    const intent = detectSeoIntent(normalizedQuery);
    const cluster = buildClusterForQuery(normalizedQuery);
    if (intent === "EXCLUDED") excluded++;
    await prisma.seoKeyword.upsert({
      where: { normalizedQuery_source: { normalizedQuery, source } },
      update: { query: row.query, impressions: row.impressions, intent, status: intent === "EXCLUDED" ? "EXCLUDED" : cluster ? "ACTIVE" : "NEEDS_REVIEW", clusterKey: cluster?.key },
      create: { query: row.query, normalizedQuery, impressions: row.impressions, source, intent, status: intent === "EXCLUDED" ? "EXCLUDED" : cluster ? "ACTIVE" : "NEEDS_REVIEW", clusterKey: cluster?.key },
    });
    imported++;
    if (cluster) {
      const prev = clusterMap.get(cluster.key) ?? { cluster, totalDemand: 0, variants: [] };
      prev.totalDemand += row.impressions;
      if (!prev.variants.includes(normalizedQuery)) prev.variants.push(normalizedQuery);
      clusterMap.set(cluster.key, prev);
    }
  }

  let clusters = 0;
  let pages = 0;
  for (const item of clusterMap.values()) {
    const landing = buildLandingText(item.cluster, item.variants, item.totalDemand);
    const filterJson = filterForCluster(item.cluster) ?? {};
    await prisma.seoCluster.upsert({
      where: { key: item.cluster.key },
      update: { title: item.cluster.title, intent: item.cluster.intent, mainQuery: item.cluster.mainQuery, totalDemand: item.totalDemand, targetType: item.cluster.targetType, targetSlug: item.cluster.targetSlug, variantsJson: item.variants },
      create: { key: item.cluster.key, title: item.cluster.title, intent: item.cluster.intent, mainQuery: item.cluster.mainQuery, totalDemand: item.totalDemand, targetType: item.cluster.targetType, targetSlug: item.cluster.targetSlug, variantsJson: item.variants },
    });
    clusters++;
    await prisma.seoLandingPage.upsert({
      where: { slug: item.cluster.targetSlug },
      update: { ...landing, type: item.cluster.targetType, mainQuery: item.cluster.mainQuery, totalDemand: item.totalDemand, filterJson: filterJson as Prisma.InputJsonValue, isIndexable: true, sitemapIncluded: true, status: "ACTIVE" },
      create: { slug: item.cluster.targetSlug, type: item.cluster.targetType, ...landing, mainQuery: item.cluster.mainQuery, totalDemand: item.totalDemand, filterJson: filterJson as Prisma.InputJsonValue, minItems: item.cluster.intent === "BASE" ? 12 : 6 },
    });
    pages++;
  }

  return { rows: rows.length, imported, excluded, clusters, pages };
}

export async function getSeoAdminStats() {
  const [keywords, activeKeywords, excludedKeywords, clusters, pages, indexablePages] = await Promise.all([
    prisma.seoKeyword.count().catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "EXCLUDED" } }).catch(() => 0),
    prisma.seoCluster.count().catch(() => 0),
    prisma.seoLandingPage.count().catch(() => 0),
    prisma.seoLandingPage.count({ where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true } }).catch(() => 0),
  ]);
  return { keywords, activeKeywords, excludedKeywords, clusters, pages, indexablePages };
}
