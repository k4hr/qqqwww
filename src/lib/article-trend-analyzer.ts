import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchTmdb } from "@/lib/tmdb";

export type ArticleSignal = {
  title: string;
  url?: string;
  sourceName?: string;
  publishedAt?: Date;
  snippet?: string;
  type?: ContentType;
};

function inferType(signal: ArticleSignal) {
  if (signal.type) return signal.type;
  return /\b(series|shows?|tv)\b|сериал/iu.test(`${signal.title} ${signal.snippet ?? ""}`) ? ContentType.SERIES : ContentType.MOVIE;
}

function extractTitles(signal: ArticleSignal) {
  const text = `${signal.title}\n${signal.snippet ?? ""}`;
  const extracted = [
    ...Array.from(text.matchAll(/[«“"]([^»”"\n]{2,100})[»”"]/gu), (match) => match[1]),
    ...Array.from(text.matchAll(/(?:^|\n)\s*(?:\d{1,2}[.)]|[-*])\s*([^\n:;]{2,100})/gu), (match) => match[1]),
  ];
  const genericHeading = /\b(best|top|popular|watched|anticipated|rating)\b|лучши|популяр|рейтинг|ожидаем/iu.test(signal.title);
  if (!extracted.length && !genericHeading) extracted.push(signal.title);
  return Array.from(new Set(extracted.map((title) => title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, "").trim()).filter((title) => title.length >= 2))).slice(0, 10);
}

async function upsertArticleCandidate(input: {
  type: ContentType;
  tmdbId: string;
  title: string;
  originalTitle: string;
  year: number | null;
  posterUrl: string | null;
  score: number;
}) {
  const existing = await prisma.trendCandidate.findFirst({
    where: { type: input.type, tmdbId: input.tmdbId, source: "ARTICLE_MENTION", sourceCategory: "article_mention" },
    select: { id: true, status: true, sourceScore: true },
  });
  const data = {
    type: input.type,
    titleRu: input.title,
    titleOriginal: input.originalTitle || input.title,
    year: input.year,
    tmdbId: input.tmdbId,
    source: "ARTICLE_MENTION",
    sourceCategory: "article_mention",
    sourceScore: Math.max(existing?.sourceScore ?? 0, input.score),
    posterUrl: input.posterUrl,
    status: existing?.status === "AVAILABLE" ? "AVAILABLE" : "PENDING",
  };
  if (existing) return prisma.trendCandidate.update({ where: { id: existing.id }, data });
  return prisma.trendCandidate.create({ data });
}

export async function ingestArticleSignals(signals: ArticleSignal[]) {
  let imported = 0;
  let matched = 0;
  for (const signal of signals) {
    const detectedYear = Number(`${signal.title} ${signal.snippet ?? ""}`.match(/(?:19|20)\d{2}/)?.[0]) || null;
    const type = inferType(signal);
    for (const detectedTitle of extractTitles(signal)) {
      const matches = await searchTmdb(detectedTitle, type);
      const match = matches.find((item) => !detectedYear || item.year === detectedYear) ?? matches[0];
      const mentionScore = match ? 10 : 2;
      await prisma.externalArticleMention.create({
        data: {
          title: signal.title,
          url: signal.url,
          sourceName: signal.sourceName,
          publishedAt: signal.publishedAt,
          detectedTitle,
          detectedYear,
          detectedType: type,
          tmdbId: match?.tmdbId,
          mentionScore,
          rawSnippet: signal.snippet,
        },
      });
      imported += 1;
      if (!match) continue;
      await prisma.movie.updateMany({
        where: { tmdbId: match.tmdbId },
        data: { articleMentionScore: { increment: mentionScore }, trendScore: { increment: mentionScore } },
      });
      await upsertArticleCandidate({
        type,
        tmdbId: match.tmdbId,
        title: match.title,
        originalTitle: match.originalTitle,
        year: match.year,
        posterUrl: match.posterUrl,
        score: mentionScore,
      });
      matched += 1;
    }
  }
  return { imported, matched };
}

// RSS/feed adapters only need to normalize entries into ArticleSignal objects.
