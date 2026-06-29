import fs from "node:fs/promises";
import path from "node:path";
import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildFranchiseWhere,
  getFranchiseConfig,
} from "@/lib/seo/franchise-orders";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";

export type SeoIntent =
  | "BASE"
  | "YEAR"
  | "FILMY_PRO"
  | "MULTIKI_PRO"
  | "FRANCHISE"
  | "FRANCHISE_ORDER"
  | "SEASON"
  | "SIMILAR"
  | "LIKE_AFTER"
  | "PERSON"
  | "GENRE_YEAR"
  | "COUNTRY_TYPE"
  | "ANIME_TOPIC"
  | "WATCH_TITLE"
  | "EXCLUDED"
  | "UNKNOWN";

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
  "COUNTRY_TYPE",
  "GENRE_YEAR",
  "ANIME_TOPIC",
  "SEASON_PAGE",
  "SIMILAR_PAGE",
  "LIKE_PAGE",
  "PERSON_PAGE",
];

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
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
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized)))
    return "EXCLUDED";
  if (/\b([1-9]|1[0-9]|2[0-5])\s*(?:й|-й)?\s*(сезон|сезона)\b/.test(normalized))
    return "SEASON";
  if (/что посмотреть|после просмотра|если понравил/.test(normalized))
    return "LIKE_AFTER";
  if (
    /похожи[ей]* на|похожие на|фильмы похожие|сериалы похожие/.test(normalized)
  )
    return "SIMILAR";
  if (/фильмы с |сериалы с |кино с |с участием/.test(normalized))
    return "PERSON";
  if (
    /марвел|marvel|мстители|avengers|человек паук|человек-паук|spider|гарри поттер|форсаж|властелин колец|терминатор|чужой|пила/.test(
      normalized,
    )
  )
    return /порядк|все части|хронолог|очеред/.test(normalized)
      ? "FRANCHISE_ORDER"
      : "FRANCHISE";
  if (
    /аниме/.test(normalized) &&
    /про |исекай|магия|романтик|школ|демон|вампир|спорт/.test(normalized)
  )
    return "ANIME_TOPIC";
  if (
    /русск|турецк|корейск|дорам|индийск|японск|американск|сша/.test(
      normalized,
    ) &&
    /фильм|сериал|аниме|дорам/.test(normalized)
  )
    return "COUNTRY_TYPE";
  if (
    /\b(20[0-3][0-9]|19[0-9]{2})\b/.test(normalized) &&
    /боевик|комеди|ужас|триллер|драм|фантаст|мелодрам|детектив|фильм|кино|мультик|мультфильм|сериал|аниме/.test(
      normalized,
    )
  )
    return /боевик|комеди|ужас|триллер|драм|фантаст|мелодрам|детектив/.test(
      normalized,
    )
      ? "GENRE_YEAR"
      : "YEAR";
  if (
    /мультик|мультфильм|мультфильмы|мультики/.test(normalized) &&
    /\bпро\b/.test(normalized)
  )
    return "MULTIKI_PRO";
  if (/фильм|фильмы|кино|сериал/.test(normalized) && /\bпро\b/.test(normalized))
    return "FILMY_PRO";
  if (
    /смотреть|онлайн|бесплатно|качество|новинки|лучшие|топ|фильмы|фильм|кино|сериалы|мультики|мультфильмы|аниме/.test(
      normalized,
    )
  )
    return "BASE";
  return "UNKNOWN";
}

function detectCsvDelimiter(line: string) {
  const candidates = [";", "\t", ","] as const;
  let best = ";";
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') quoted = !quoted;
      if (!quoted && char === delimiter) count++;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvLine(line: string) {
  const delimiter = detectCsvDelimiter(line);
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
    if (char === delimiter && !quoted) {
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
  let queryIndex = 0;
  let impressionsIndex = 1;
  let headerChecked = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = parseCsvLine(line);

    if (!headerChecked) {
      headerChecked = true;
      const lowered = cells.map((cell) => normalizeSeoQuery(cell));
      const qIndex = lowered.findIndex((cell) => /^(запрос|query|keyword|ключ|фраза|поисковая фраза)$/.test(cell) || cell.includes("запрос"));
      const iIndex = lowered.findIndex((cell) => /показ|частот|impression|frequency|freq|число/.test(cell));
      if (qIndex >= 0) queryIndex = qIndex;
      if (iIndex >= 0) impressionsIndex = iIndex;
      if (qIndex >= 0 || iIndex >= 0) continue;
    }

    const query = String(cells[queryIndex] ?? cells[0] ?? "").trim();
    const impressions = parseImpressions(String(cells[impressionsIndex] ?? cells[1] ?? ""));

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
    .replace(
      /\b(смотреть|онлайн|бесплатно|в хорошем качестве|фильмы|фильм|кино|мультики|мультик|мультфильмы|мультфильм|сериалы|сериал)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function yearFromQuery(query: string) {
  const match = normalizeSeoQuery(query).match(/\b(20[0-3][0-9]|19[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function seasonFromQuery(query: string) {
  const match = normalizeSeoQuery(query).match(
    /\b([1-9]|1[0-9]|2[0-5])\s*(?:й|-й)?\s*(сезон|сезона)\b/,
  );
  return match ? Number(match[1]) : null;
}

function titleFromEntityQuery(query: string) {
  return normalizeSeoQuery(query)
    .replace(
      /\b(что посмотреть если понравил[ао]сь?|что посмотреть после|после просмотра|похожие на|похожи[ей]* на|фильмы похожие на|сериалы похожие на|фильмы с|сериалы с|кино с|с участием)\b/g,
      " ",
    )
    .replace(/\b([1-9]|1[0-9]|2[0-5])\s*(?:й|-й)?\s*(сезон|сезона)\b/g, " ")
    .replace(
      /\b(смотреть|онлайн|бесплатно|в хорошем качестве|хорошем качестве|hd|fullhd|1080p?|720p?|фильм|фильмы|кино|сериал|сериалы|мультфильм|мультфильмы|аниме|все серии|все сезоны|серии подряд|лордфильм|lordfilm|редфильм|redfilm)\b/g,
      " ",
    )
    .replace(/\b(20[0-3][0-9]|19[0-9]{2})\b/g, " ")
    .replace(/[^a-zа-я0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseRu(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned
    ? `${cleaned[0].toLocaleUpperCase("ru-RU")}${cleaned.slice(1)}`
    : cleaned;
}

function countryTypeCluster(query: string) {
  const normalized = normalizeSeoQuery(query);
  const country = [
    { pattern: /русск|росси/, slug: "russkie", title: "Русские" },
    { pattern: /турецк|турц/, slug: "tureckie", title: "Турецкие" },
    { pattern: /корейск|дорам/, slug: "koreyskie", title: "Корейские" },
    { pattern: /индийск|индия/, slug: "indiyskie", title: "Индийские" },
    { pattern: /японск|япони/, slug: "yaponskie", title: "Японские" },
    { pattern: /американск|сша/, slug: "amerikanskie", title: "Американские" },
  ].find((item) => item.pattern.test(normalized));
  if (!country) return null;
  const year = yearFromQuery(normalized);
  const typeSlug = /сериал|дорам/.test(normalized)
    ? "serialy"
    : /аниме/.test(normalized)
      ? "anime"
      : "filmy";
  const typeTitle =
    typeSlug === "serialy"
      ? "сериалы"
      : typeSlug === "anime"
        ? "аниме"
        : "фильмы";
  const slug = `${country.slug}-${typeSlug}${year ? `-${year}` : ""}`;
  return {
    key: slug,
    targetSlug: slug,
    intent: "COUNTRY_TYPE" as const,
    targetType: "COUNTRY_TYPE",
    title: `${country.title} ${typeTitle}${year ? ` ${year}` : ""}`,
    mainQuery: `${country.title.toLowerCase()} ${typeTitle}${year ? ` ${year}` : ""}`,
  };
}

function genreYearCluster(query: string) {
  const normalized = normalizeSeoQuery(query);
  const year = yearFromQuery(normalized);
  const match = normalized.match(
    /\b(боевик[иов]*|комеди[яи]*|ужас[ыов]*|триллер[ыов]*|драм[аы]*|фантастик[аи]*|мелодрам[аы]*|детектив[ыов]*|криминал|приключени[яй]*)\b/,
  );
  if (!year || !match) return null;
  const genre = match[1].replace(/ы$|ов$|и$/g, "");
  const slug = `${slugifyRu(genre)}-${year}`;
  return {
    key: slug,
    targetSlug: slug,
    intent: "GENRE_YEAR" as const,
    targetType: "GENRE_YEAR",
    title: `${titleCaseRu(genre)} ${year}`,
    mainQuery: `${genre} ${year}`,
  };
}

function animeTopicCluster(query: string) {
  const normalized = normalizeSeoQuery(query);
  const topic =
    titleFromEntityQuery(normalized).replace(/^аниме\s+/, "") ||
    afterPro(normalized) ||
    "popularnoe";
  const year = yearFromQuery(normalized);
  const slug = `anime-${slugifyRu(topic)}${year ? `-${year}` : ""}`;
  return {
    key: slug,
    targetSlug: slug,
    intent: "ANIME_TOPIC" as const,
    targetType: "ANIME_TOPIC",
    title: `Аниме ${topic}${year ? ` ${year}` : ""}`,
    mainQuery: `аниме ${topic}${year ? ` ${year}` : ""}`,
  };
}

function franchiseOrderCluster(query: string) {
  const normalized = normalizeSeoQuery(query);
  const aliases = [
    {
      pattern: /марвел|marvel|мстител|avengers/,
      slug: "filmy-marvel-po-poryadku",
      title: "Фильмы Marvel по порядку",
    },
    {
      pattern: /гарри поттер|harry potter/,
      slug: "garri-potter-vse-chasti",
      title: "Гарри Поттер все части по порядку",
    },
    {
      pattern: /форсаж|fast furious/,
      slug: "forsazh-vse-chasti",
      title: "Форсаж все части по порядку",
    },
    {
      pattern: /властелин колец|lord of the rings|хоббит/,
      slug: "vlastelin-kolets-vse-chasti",
      title: "Властелин колец все части по порядку",
    },
    {
      pattern: /человек паук|человек-паук|spider/,
      slug: "chelovek-pauk-vse-chasti",
      title: "Человек-паук все части по порядку",
    },
    {
      pattern: /пила\b|saw\b/,
      slug: "pila-vse-chasti",
      title: "Пила все части по порядку",
    },
    {
      pattern: /терминатор|terminator/,
      slug: "terminator-vse-chasti",
      title: "Терминатор все части по порядку",
    },
    {
      pattern: /чужой|alien/,
      slug: "chuzhoy-vse-chasti",
      title: "Чужой все части по порядку",
    },
  ];
  const hit = aliases.find((item) => item.pattern.test(normalized));
  if (!hit) return null;
  return {
    key: hit.slug,
    targetSlug: hit.slug,
    intent: "FRANCHISE_ORDER" as const,
    targetType: "FRANCHISE_ORDER",
    title: hit.title,
    mainQuery: hit.title.toLowerCase(),
  };
}

export function buildClusterForQuery(query: string) {
  const normalized = normalizeSeoQuery(query);
  const intent = detectSeoIntent(normalized);
  if (intent === "EXCLUDED" || intent === "UNKNOWN") return null;

  if (intent === "SEASON") {
    const season = seasonFromQuery(normalized);
    const title = titleFromEntityQuery(normalized);
    if (!season || !title || title.length < 3) return null;
    const slug = `${slugifyRu(title)}-${season}-sezon`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: "SEASON_PAGE",
      title: `${titleCaseRu(title)} ${season} сезон`,
      mainQuery: `${title} ${season} сезон`,
    };
  }

  if (intent === "SIMILAR" || intent === "LIKE_AFTER") {
    const title = titleFromEntityQuery(normalized);
    if (!title || title.length < 3) return null;
    const prefix =
      intent === "LIKE_AFTER" ? "chto-posmotret-posle" : "pohozhie-na";
    const slug = `${prefix}-${slugifyRu(title)}`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: intent === "LIKE_AFTER" ? "LIKE_PAGE" : "SIMILAR_PAGE",
      title:
        intent === "LIKE_AFTER"
          ? `Что посмотреть если понравился ${title}`
          : `Фильмы похожие на ${title}`,
      mainQuery: normalized,
    };
  }

  if (intent === "PERSON") {
    const title = titleFromEntityQuery(normalized);
    if (!title || title.length < 3) return null;
    const slug = `filmy-s-${slugifyRu(title)}`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: "PERSON_PAGE",
      title: `Фильмы с ${title}`,
      mainQuery: `фильмы с ${title}`,
    };
  }

  if (intent === "COUNTRY_TYPE") {
    const cluster = countryTypeCluster(normalized);
    if (cluster) return cluster;
  }

  if (intent === "GENRE_YEAR") {
    const cluster = genreYearCluster(normalized);
    if (cluster) return cluster;
  }

  if (intent === "ANIME_TOPIC") {
    return animeTopicCluster(normalized);
  }

  if (intent === "FILMY_PRO") {
    const topic = afterPro(normalized);
    if (!topic || topic.length < 3) return null;
    const slug = `filmy-pro-${slugifyRu(topic)}`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: "COLLECTION",
      title: `Фильмы про ${topic}`,
      mainQuery: `фильмы про ${topic}`,
    };
  }

  if (intent === "MULTIKI_PRO") {
    const topic = afterPro(normalized);
    if (!topic || topic.length < 3) return null;
    const slug = `multiki-pro-${slugifyRu(topic)}`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: "CARTOON_COLLECTION",
      title: `Мультики про ${topic}`,
      mainQuery: `мультики про ${topic}`,
    };
  }

  if (intent === "YEAR") {
    const year = yearFromQuery(normalized);
    if (!year) return null;
    const isCartoon = /мульт|мультик/.test(normalized);
    const isSeries = /сериал/.test(normalized);
    const isAnime = /аниме/.test(normalized);
    const prefix = isCartoon
      ? "multfilmy"
      : isSeries
        ? "serialy"
        : isAnime
          ? "anime"
          : "filmy";
    const titlePrefix = isCartoon
      ? "Мультфильмы"
      : isSeries
        ? "Сериалы"
        : isAnime
          ? "Аниме"
          : "Фильмы";
    const slug = `${prefix}-${year}`;
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: isCartoon
        ? "CARTOON_YEAR"
        : isSeries
          ? "SERIES_YEAR"
          : isAnime
            ? "ANIME_YEAR"
            : "MOVIE_YEAR",
      title: `${titlePrefix} ${year}`,
      mainQuery: `${titlePrefix.toLowerCase()} ${year}`,
    };
  }

  if (intent === "FRANCHISE" || intent === "FRANCHISE_ORDER") {
    const order = franchiseOrderCluster(normalized);
    if (order) return order;
    const slug = /марвел|marvel|мстители|avengers/.test(normalized)
      ? "filmy-marvel-po-poryadku"
      : "filmy-franshizy";
    const config = getFranchiseConfig(slug);
    const title =
      config?.h1 ??
      (slug === "filmy-marvel-po-poryadku"
        ? "Фильмы Marvel по порядку"
        : "Популярные кинофраншизы");
    return {
      key: slug,
      targetSlug: slug,
      intent,
      targetType: config ? "FRANCHISE_ORDER" : "FRANCHISE",
      title,
      mainQuery: title.toLowerCase(),
    };
  }

  const slug = /мульт|мультик/.test(normalized)
    ? "multfilmy-smotret-online"
    : /сериал/.test(normalized)
      ? "serialy-smotret-online"
      : /аниме/.test(normalized)
        ? "anime-smotret-online"
        : "filmy-smotret-online";
  const title = slug.startsWith("mult")
    ? "Мультфильмы смотреть онлайн"
    : slug.startsWith("serial")
      ? "Сериалы смотреть онлайн"
      : slug.startsWith("anime")
        ? "Аниме смотреть онлайн"
        : "Фильмы смотреть онлайн";
  return {
    key: slug,
    targetSlug: slug,
    intent: "BASE" as const,
    targetType: "BASE",
    title,
    mainQuery: title.toLowerCase(),
  };
}

export function buildLandingText(
  cluster: {
    title: string;
    mainQuery: string;
    targetSlug: string;
    targetType: string;
  },
  variants: string[],
  totalDemand: number,
) {
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
  return {
    title,
    h1,
    description,
    introText,
    keywordVariants: variants.slice(0, 40),
  };
}

function landingIntroForCluster(cluster: {
  title: string;
  mainQuery: string;
  targetSlug: string;
  targetType: string;
}) {
  const title = cluster.title.toLowerCase();
  if (cluster.targetType === "BASE") {
    if (cluster.targetSlug.startsWith("serial"))
      return "В разделе собраны сериалы REDFILM с плеером, постерами, рейтингами и удобной навигацией по жанрам, годам и подборкам.";
    if (cluster.targetSlug.startsWith("mult"))
      return "В разделе собраны мультфильмы REDFILM: новинки, семейные истории, приключения и популярные анимационные фильмы для просмотра онлайн.";
    if (cluster.targetSlug.startsWith("anime"))
      return "В разделе собраны аниме REDFILM с доступным плеером, постерами, рейтингами и быстрым переходом к похожим тайтлам.";
    return "В разделе собраны фильмы REDFILM для онлайн-просмотра: новинки, популярные картины, жанровые подборки и проверенные хиты с рейтингами.";
  }
  if (cluster.targetType === "SEASON_PAGE") {
    return `Сезонная SEO-страница REDFILM под запрос «${title}»: основной сериал, плеер, другие сезоны, похожие сериалы и быстрый переход к просмотру.`;
  }
  if (
    cluster.targetType === "SIMILAR_PAGE" ||
    cluster.targetType === "LIKE_PAGE"
  ) {
    return `Страница REDFILM под запрос «${title}»: похожие фильмы и сериалы, что посмотреть после, жанровые пересечения и быстрые ссылки на просмотр.`;
  }
  if (cluster.targetType === "PERSON_PAGE") {
    return `Страница REDFILM под запрос «${title}»: фильмы и сериалы с актёром, доступные тайтлы, рейтинги и удобная навигация.`;
  }
  if (
    cluster.targetType === "COUNTRY_TYPE" ||
    cluster.targetType === "GENRE_YEAR" ||
    cluster.targetType === "ANIME_TOPIC"
  ) {
    return `Подборка REDFILM по запросу «${title}»: доступные тайтлы с плеером, постерами, рейтингами и связями с похожими страницами.`;
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
  const value =
    typeof filter === "object" && filter
      ? (filter as Record<string, unknown>)
      : {};
  const targetType = String(value.targetType ?? "COLLECTION");
  const slug = String(value.slug ?? value.targetSlug ?? "").trim();
  const franchiseWhere =
    targetType === "FRANCHISE_ORDER" || targetType === "FRANCHISE"
      ? buildFranchiseWhere(slug)
      : null;
  if (franchiseWhere) return franchiseWhere;
  const topic = String(value.topic ?? "").trim();
  const year = Number(value.year);
  const words = topic
    ? topic
        .split(/\s+/)
        .filter((word) => word.length >= 3)
        .slice(0, 4)
    : [];
  const textWhere = words.length
    ? {
        OR: words.flatMap((word) => [
          { titleRu: { contains: word, mode: "insensitive" as const } },
          { titleOriginal: { contains: word, mode: "insensitive" as const } },
          { description: { contains: word, mode: "insensitive" as const } },
          {
            genres: {
              some: {
                genre: {
                  name: { contains: word, mode: "insensitive" as const },
                },
              },
            },
          },
        ]),
      }
    : {};
  const yearWhere = Number.isFinite(year) && year > 1900 ? { year } : {};
  const typeWhere: Prisma.MovieWhereInput =
    targetType === "CARTOON_COLLECTION" || targetType === "CARTOON_YEAR"
      ? { type: ContentType.CARTOON }
      : targetType === "SERIES_YEAR" || targetType === "SEASON_PAGE"
        ? { type: ContentType.SERIES }
        : targetType === "ANIME_YEAR" || targetType === "ANIME_TOPIC"
          ? { type: ContentType.ANIME }
          : targetType === "MOVIE_YEAR"
            ? { type: ContentType.MOVIE }
            : {};
  return {
    AND: [typeWhere, yearWhere, textWhere].filter(
      (item) => Object.keys(item).length,
    ),
  };
}

function landingStateForCluster(
  cluster: NonNullable<ReturnType<typeof buildClusterForQuery>>,
) {
  if (cluster.targetType === "BASE") {
    return {
      status: "REDIRECT",
      isIndexable: false,
      sitemapIncluded: false,
      minItems: 12,
    };
  }
  if (cluster.targetType === "FRANCHISE_ORDER") {
    return {
      status: "ACTIVE",
      isIndexable: true,
      sitemapIncluded: true,
      minItems: 3,
    };
  }
  if (
    ["SEASON_PAGE", "SIMILAR_PAGE", "LIKE_PAGE", "PERSON_PAGE"].includes(
      cluster.targetType,
    )
  ) {
    return {
      status: "ACTIVE",
      isIndexable: true,
      sitemapIncluded: true,
      minItems: 1,
    };
  }
  return {
    status: "ACTIVE",
    isIndexable: true,
    sitemapIncluded: true,
    minItems: cluster.intent === "BASE" ? 12 : 6,
  };
}

async function countMoviesForSeoLanding(page: {
  slug: string;
  type: string;
  filterJson: Prisma.JsonValue | null;
  minItems: number;
}) {
  if (page.type === "BASE") return 0;
  if (
    ["SEASON_PAGE", "SIMILAR_PAGE", "LIKE_PAGE", "PERSON_PAGE"].includes(
      page.type,
    )
  )
    return page.minItems;
  const config = getFranchiseConfig(page.slug);
  const where = whereForSeoLanding(
    config ? { targetType: page.type, targetSlug: page.slug } : page.filterJson,
  );
  return prisma.movie
    .count({
      where: {
        AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), where],
      },
    })
    .catch(() => 0);
}

export async function applySeoLandingQualityGate(limit = 10000) {
  const pages = await prisma.seoLandingPage.findMany({
    where: { type: { in: GENERATED_LANDING_TYPES } },
    select: {
      id: true,
      slug: true,
      type: true,
      filterJson: true,
      minItems: true,
      status: true,
    },
    orderBy: [{ totalDemand: "desc" }, { updatedAt: "desc" }],
    take: Math.max(1, Math.min(limit, 10000)),
  });

  let active = 0;
  let thin = 0;
  let redirects = 0;
  let checked = 0;

  for (const page of pages) {
    checked++;
    if (page.type === "BASE") {
      await prisma.seoLandingPage.update({
        where: { id: page.id },
        data: {
          status: "REDIRECT",
          isIndexable: false,
          sitemapIncluded: false,
        },
      });
      redirects++;
      continue;
    }

    const items = await countMoviesForSeoLanding(page);
    const minItems =
      page.type === "FRANCHISE_ORDER"
        ? Math.min(page.minItems, 3)
        : page.minItems;
    if (items < minItems) {
      await prisma.seoLandingPage.update({
        where: { id: page.id },
        data: { status: "THIN", isIndexable: false, sitemapIncluded: false },
      });
      thin++;
    } else {
      await prisma.seoLandingPage.update({
        where: { id: page.id },
        data: {
          status: "ACTIVE",
          isIndexable: true,
          sitemapIncluded: true,
          aiError: null,
        },
      });
      active++;
    }
  }

  return { checked, active, thin, redirects };
}

function filterForCluster(cluster: ReturnType<typeof buildClusterForQuery>) {
  if (!cluster) return undefined;
  const topic =
    cluster.intent === "FILMY_PRO" ||
    cluster.intent === "MULTIKI_PRO" ||
    cluster.intent === "ANIME_TOPIC" ||
    cluster.intent === "GENRE_YEAR" ||
    cluster.intent === "COUNTRY_TYPE"
      ? cluster.mainQuery.replace(/^фильмы про |^мультики про |^аниме /, "")
      : undefined;
  const year =
    cluster.intent === "YEAR" ||
    cluster.intent === "GENRE_YEAR" ||
    cluster.intent === "COUNTRY_TYPE" ||
    cluster.intent === "ANIME_TOPIC"
      ? yearFromQuery(cluster.mainQuery)
      : undefined;
  return {
    targetType: cluster.targetType,
    targetSlug: cluster.targetSlug,
    topic,
    year,
  };
}

async function resetGeneratedSeoPages() {
  await prisma.seoLandingPage.deleteMany({
    where: { type: { in: GENERATED_LANDING_TYPES } },
  });
  await prisma.seoCluster.deleteMany({});
}

export async function resetWordstatSeoEngine() {
  await resetGeneratedSeoPages();
  await prisma.seoKeyword.deleteMany({
    where: { source: { startsWith: "wordstat" } },
  });
}

export async function importWordstatRows(
  rowsInput: WordstatRow[],
  source = "wordstat",
  options?: { replace?: boolean },
) {
  if (options?.replace) {
    await resetWordstatSeoEngine();
  }

  const rows = dedupeRows(rowsInput);
  let imported = 0;
  let excluded = 0;
  let active = 0;
  let needsReview = 0;
  const clusterMap = new Map<
    string,
    {
      cluster: NonNullable<ReturnType<typeof buildClusterForQuery>>;
      totalDemand: number;
      variants: string[];
    }
  >();

  for (const row of rows) {
    const normalizedQuery = row.normalizedQuery ?? normalizeSeoQuery(row.query);
    const intent = detectSeoIntent(normalizedQuery);
    const cluster = buildClusterForQuery(normalizedQuery);
    const status =
      intent === "EXCLUDED" ? "EXCLUDED" : cluster ? "ACTIVE" : "NEEDS_REVIEW";

    if (status === "EXCLUDED") excluded++;
    if (status === "ACTIVE") active++;
    if (status === "NEEDS_REVIEW") needsReview++;

    await prisma.seoKeyword.upsert({
      where: { normalizedQuery_source: { normalizedQuery, source } },
      update: {
        query: row.query,
        impressions: row.impressions,
        intent,
        status,
        clusterKey: cluster?.key,
      },
      create: {
        query: row.query,
        normalizedQuery,
        impressions: row.impressions,
        source,
        intent,
        status,
        clusterKey: cluster?.key,
      },
    });
    imported++;

    if (cluster) {
      const prev = clusterMap.get(cluster.key) ?? {
        cluster,
        totalDemand: 0,
        variants: [],
      };
      prev.totalDemand = int4(prev.totalDemand + row.impressions);
      if (!prev.variants.includes(normalizedQuery))
        prev.variants.push(normalizedQuery);
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
      update: {
        title: item.cluster.title,
        intent: item.cluster.intent,
        mainQuery: item.cluster.mainQuery,
        totalDemand,
        targetType: item.cluster.targetType,
        targetSlug: item.cluster.targetSlug,
        variantsJson: item.variants,
        status: "ACTIVE",
      },
      create: {
        key: item.cluster.key,
        title: item.cluster.title,
        intent: item.cluster.intent,
        mainQuery: item.cluster.mainQuery,
        totalDemand,
        targetType: item.cluster.targetType,
        targetSlug: item.cluster.targetSlug,
        variantsJson: item.variants,
        status: "ACTIVE",
      },
    });
    clusters++;
    const state = landingStateForCluster(item.cluster);
    await prisma.seoLandingPage.upsert({
      where: { slug: item.cluster.targetSlug },
      update: {
        ...landing,
        type: item.cluster.targetType,
        mainQuery: item.cluster.mainQuery,
        totalDemand,
        filterJson: filterJson as Prisma.InputJsonValue,
        minItems: state.minItems,
        isIndexable: state.isIndexable,
        sitemapIncluded: state.sitemapIncluded,
        status: state.status,
      },
      create: {
        slug: item.cluster.targetSlug,
        type: item.cluster.targetType,
        ...landing,
        mainQuery: item.cluster.mainQuery,
        totalDemand,
        filterJson: filterJson as Prisma.InputJsonValue,
        minItems: state.minItems,
        status: state.status,
        isIndexable: state.isIndexable,
        sitemapIncluded: state.sitemapIncluded,
      },
    });
    pages++;
  }

  return {
    rows: rowsInput.length,
    uniqueRows: rows.length,
    imported,
    active,
    excluded,
    needsReview,
    clusters,
    pages,
  };
}

export async function importWordstatKeywords(
  text: string,
  source = "wordstat",
  options?: { replace?: boolean },
) {
  return importWordstatRows(parseWordstatCsv(text), source, options);
}

export async function importEmbeddedWordstatFiles(options?: {
  replace?: boolean;
}) {
  const dir = path.join(process.cwd(), "src", "data", "wordstat");
  const files = (await fs.readdir(dir).catch(() => []))
    .filter((file) => file.endsWith(".csv"))
    .sort();
  const rows: WordstatRow[] = [];

  for (const file of files) {
    const text = await fs.readFile(path.join(dir, file), "utf8");
    rows.push(...parseWordstatCsv(text));
  }

  const result = await importWordstatRows(rows, "wordstat", {
    replace: options?.replace ?? true,
  });
  const quality = await applySeoLandingQualityGate();
  return { files: files.length, ...result, quality };
}

export async function getSeoAdminStats() {
  const [
    keywords,
    activeKeywords,
    excludedKeywords,
    reviewKeywords,
    clusters,
    pages,
    indexablePages,
  ] = await Promise.all([
    prisma.seoKeyword.count().catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    prisma.seoKeyword.count({ where: { status: "EXCLUDED" } }).catch(() => 0),
    prisma.seoKeyword
      .count({ where: { status: "NEEDS_REVIEW" } })
      .catch(() => 0),
    prisma.seoCluster.count().catch(() => 0),
    prisma.seoLandingPage.count().catch(() => 0),
    prisma.seoLandingPage
      .count({
        where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true },
      })
      .catch(() => 0),
  ]);
  return {
    keywords,
    activeKeywords,
    excludedKeywords,
    reviewKeywords,
    clusters,
    pages,
    indexablePages,
  };
}
