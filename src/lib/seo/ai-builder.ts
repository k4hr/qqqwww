import { Prisma } from "@prisma/client";
import type { SeoLandingPage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { watchPath } from "@/lib/seo-links";
import { whereForSeoLanding } from "@/lib/seo/keyword-engine";
import { getFranchiseConfig, sortMoviesByFranchiseOrder } from "@/lib/seo/franchise-orders";

export type AiSeoDraft = {
  title: string;
  h1: string;
  description: string;
  introText: string;
  seoSummary: string;
  sections: Array<{ title: string; body: string; movieSlugs: string[] }>;
  faq: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ label: string; url: string }>;
};

type AiSeoMovie = {
  slug: string;
  titleRu: string;
  titleOriginal: string | null;
  year: number;
  type: string;
  description: string;
  country: string | null;
  kpRating: number | null;
  imdbRating: number | null;
  kpVotes: number | null;
  imdbVotes: number | null;
  genres: string[];
  cast: string[];
  url: string;
};

const FORBIDDEN_PUBLIC_PHRASES = [
  "страница создана на основе",
  "поискового спроса wordstat",
  "суммарный спрос",
  "внутренними ссылками",
  "доступные тайтлы",
  "seo-посадочная",
];

const AI_SEO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    h1: { type: "string" },
    description: { type: "string" },
    introText: { type: "string" },
    seoSummary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          movieSlugs: { type: "array", items: { type: "string" } },
        },
        required: ["title", "body", "movieSlugs"],
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
    internalLinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          url: { type: "string" },
        },
        required: ["label", "url"],
      },
    },
  },
  required: ["title", "h1", "description", "introText", "seoSummary", "sections", "faq", "internalLinks"],
} as const;

function safeText(value: string, fallback: string, maxLength: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function containsForbidden(text: string) {
  const normalized = text.toLowerCase().replaceAll("ё", "е");
  return FORBIDDEN_PUBLIC_PHRASES.some((phrase) => normalized.includes(phrase));
}

function extractResponseText(data: unknown) {
  const root = data as Record<string, unknown>;
  if (typeof root.output_text === "string") return root.output_text;
  const output = Array.isArray(root.output) ? root.output : [];
  for (const item of output) {
    const message = item as Record<string, unknown>;
    const content = Array.isArray(message.content) ? message.content : [];
    for (const chunk of content) {
      const value = chunk as Record<string, unknown>;
      if (typeof value.text === "string") return value.text;
      if (typeof value.output_text === "string") return value.output_text;
    }
  }
  return "";
}

function parseAiJson(text: string): AiSeoDraft {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed) as AiSeoDraft;
}

function validateDraft(draft: AiSeoDraft, allowedMovieSlugs: Set<string>, fallback: { title: string; h1: string; description: string; introText: string }) {
  const clean: AiSeoDraft = {
    title: safeText(draft.title, fallback.title, 90),
    h1: safeText(draft.h1, fallback.h1, 80),
    description: safeText(draft.description, fallback.description, 170),
    introText: safeText(draft.introText, fallback.introText, 900),
    seoSummary: safeText(draft.seoSummary, "Страница собрана из реальных фильмов REDFILM.", 400),
    sections: Array.isArray(draft.sections) ? draft.sections.slice(0, 6).map((section) => ({
      title: safeText(section.title, "Подборка", 80),
      body: safeText(section.body, "Фильмы подобраны по теме страницы и доступны в каталоге REDFILM.", 500),
      movieSlugs: Array.isArray(section.movieSlugs) ? section.movieSlugs.filter((slug) => allowedMovieSlugs.has(slug)).slice(0, 24) : [],
    })).filter((section) => section.title && section.body) : [],
    faq: Array.isArray(draft.faq) ? draft.faq.slice(0, 5).map((item) => ({
      question: safeText(item.question, "Что посмотреть?", 120),
      answer: safeText(item.answer, "Выберите фильм из подборки и откройте страницу просмотра.", 350),
    })).filter((item) => item.question && item.answer) : [],
    internalLinks: Array.isArray(draft.internalLinks) ? draft.internalLinks.slice(0, 10).map((item) => ({
      label: safeText(item.label, "Подборка", 80),
      url: String(item.url ?? "").startsWith("/") ? String(item.url) : "/collections",
    })).filter((item) => item.label && item.url) : [],
  };

  const publicText = [clean.title, clean.h1, clean.description, clean.introText, clean.seoSummary, ...clean.sections.flatMap((item) => [item.title, item.body]), ...clean.faq.flatMap((item) => [item.question, item.answer])].join("\n");
  if (containsForbidden(publicText)) {
    throw new Error("AI draft contains forbidden bot-like public phrases.");
  }
  return clean;
}

function movieForAi(movie: Awaited<ReturnType<typeof loadMoviesForLanding>>[number]): AiSeoMovie {
  return {
    slug: movie.slug,
    titleRu: movie.titleRu,
    titleOriginal: movie.titleOriginal,
    year: movie.year,
    type: movie.type,
    description: safeText(movie.description, "", 450),
    country: movie.country,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
    kpVotes: movie.kpVotes,
    imdbVotes: movie.imdbVotes,
    genres: movie.genres.map((item) => item.genre.name),
    cast: movie.cast.map((item) => item.person.nameRu).filter(Boolean).slice(0, 12),
    url: watchPath(movie),
  };
}

async function loadMoviesForLanding(landing: { slug: string; type: string; filterJson: Prisma.JsonValue | null; minItems: number }) {
  const config = getFranchiseConfig(landing.slug);
  const where = config ? whereForSeoLanding({ targetType: "FRANCHISE_ORDER", targetSlug: landing.slug }) : whereForSeoLanding(landing.filterJson);
  const movies = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), where] },
    include: { genres: { include: { genre: true } }, cast: { include: { person: true }, take: 12, orderBy: { sortOrder: "asc" } } },
    orderBy: config ? [{ year: "asc" }, { topScore: "desc" }] : [{ topScore: "desc" }, { popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
    take: config ? 120 : 80,
  });
  return config ? sortMoviesByFranchiseOrder(landing.slug, movies).slice(0, 80) : movies;
}

function buildPromptContext(landing: SeoLandingPage, movies: Awaited<ReturnType<typeof loadMoviesForLanding>>) {
  const config = getFranchiseConfig(landing.slug);
  return {
    site: "REDFILM",
    page: {
      slug: landing.slug,
      type: landing.type,
      mainQuery: landing.mainQuery,
      currentTitle: landing.title,
      currentH1: landing.h1,
      currentDescription: landing.description,
      keywordVariants: landing.keywordVariants.slice(0, 30),
      totalDemand: landing.totalDemand,
    },
    intentRules: config ? {
      type: "FRANCHISE_ORDER",
      rule: "Страница должна объяснять порядок просмотра. Не делай обычную случайную подборку. Используй только фильмы из movieCandidates. Не упоминай отсутствующие фильмы как доступные на сайте.",
      chronology: config.chronology.map((item) => ({ title: item.title, year: item.year, aliases: item.aliases, phase: item.phase })),
      releaseOrder: config.releaseOrder.map((item) => ({ title: item.title, year: item.year, aliases: item.aliases, phase: item.phase })),
    } : {
      type: landing.type,
      rule: "Страница должна быть человеческой SEO-подборкой. Не пиши технических фраз про Wordstat, кластеры, спрос, sitemap или внутренние ссылки.",
    },
    movieCandidates: movies.map(movieForAi),
    hardRules: [
      "Пиши на русском языке.",
      "Не выдумывай фильмы, актёров, рейтинги и факты.",
      "В movieSlugs используй только slug из movieCandidates.",
      "Не пиши фразы: страница создана на основе Wordstat, суммарный спрос, SEO-посадочная, внутренние ссылки.",
      "Title до 90 символов, description до 170 символов, introText 2-4 коротких абзаца.",
      "Если это страница 'по порядку', обязательно сделай секции для хронологии и порядка выхода, насколько позволяют movieCandidates.",
      "Не обещай прямые видеофайлы или скачивание. Формулируй как смотреть онлайн на странице REDFILM.",
    ],
  };
}

export async function generateAiSeoLandingPage(slug: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SEO_MODEL || "gpt-4.1-mini";
  const landing = await prisma.seoLandingPage.findUnique({ where: { slug } });
  if (!landing) throw new Error(`SeoLandingPage not found: ${slug}`);

  if (!apiKey) {
    await prisma.seoLandingPage.update({ where: { slug }, data: { aiStatus: "FAILED", aiError: "OPENAI_API_KEY is not configured" } });
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const movies = await loadMoviesForLanding(landing);
  if (movies.length < landing.minItems) {
    await prisma.seoLandingPage.update({ where: { slug }, data: { aiStatus: "NEEDS_REVIEW", aiError: `Not enough movies for AI page: ${movies.length}/${landing.minItems}` } });
    return { ok: false, slug, status: "NEEDS_REVIEW", movies: movies.length, message: "Недостаточно фильмов для AI-страницы." };
  }

  const context = buildPromptContext(landing, movies);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "Ты профессиональный SEO-редактор кино-сайта REDFILM. Возвращай только валидный JSON по схеме. Текст должен быть живой, без канцелярита и без технических фраз." },
        { role: "user", content: JSON.stringify(context) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "redfilm_seo_landing_page",
          strict: true,
          schema: AI_SEO_SCHEMA,
        },
      },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = JSON.stringify(body ?? { status: response.status }).slice(0, 2000);
    await prisma.seoLandingPage.update({ where: { slug }, data: { aiStatus: "FAILED", aiModel: model, aiError: error } });
    throw new Error(error);
  }

  const rawText = extractResponseText(body);
  const parsed = parseAiJson(rawText);
  const allowedSlugs = new Set(movies.map((movie) => movie.slug));
  const draft = validateDraft(parsed, allowedSlugs, { title: landing.title, h1: landing.h1, description: landing.description, introText: landing.introText });

  await prisma.seoLandingPage.update({
    where: { slug },
    data: {
      title: draft.title,
      h1: draft.h1,
      description: draft.description,
      introText: draft.introText,
      aiDraftJson: draft as unknown as Prisma.InputJsonValue,
      aiStatus: "PUBLISHED",
      aiModel: model,
      aiGeneratedAt: new Date(),
      aiError: null,
    },
  });

  return { ok: true, slug, model, movies: movies.length, sections: draft.sections.length, faq: draft.faq.length };
}

export async function generateTopAiSeoLandingPages(limit = 10) {
  const pages = await prisma.seoLandingPage.findMany({
    where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true, type: { not: "BASE" } },
    orderBy: [{ aiStatus: "asc" }, { totalDemand: "desc" }, { updatedAt: "desc" }],
    select: { slug: true },
    take: Math.max(1, Math.min(limit, 30)),
  });

  const results = [];
  for (const page of pages) {
    try {
      results.push(await generateAiSeoLandingPage(page.slug));
    } catch (error) {
      results.push({ ok: false, slug: page.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { count: pages.length, results };
}

export function readAiSeoDraft(value: unknown): AiSeoDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<AiSeoDraft>;
  if (!draft.introText && !draft.sections && !draft.faq) return null;
  return {
    title: String(draft.title ?? ""),
    h1: String(draft.h1 ?? ""),
    description: String(draft.description ?? ""),
    introText: String(draft.introText ?? ""),
    seoSummary: String(draft.seoSummary ?? ""),
    sections: Array.isArray(draft.sections) ? draft.sections as AiSeoDraft["sections"] : [],
    faq: Array.isArray(draft.faq) ? draft.faq as AiSeoDraft["faq"] : [],
    internalLinks: Array.isArray(draft.internalLinks) ? draft.internalLinks as AiSeoDraft["internalLinks"] : [],
  };
}
