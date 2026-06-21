import { NextResponse } from "next/server";
import { getQualityBlockReasons } from "@/lib/home-quality-score";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [latestRun, statuses, candidateTotal, home, hero, trending, missingPoster, missingBackdrop, blocked, titleRows, blockedSample] = await Promise.all([
    prisma.trendSyncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.trendCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.trendCandidate.count(),
    prisma.movie.count({ where: { isHomeEligible: true } }),
    prisma.movie.count({ where: { isHeroEligible: true } }),
    prisma.movie.count({ where: { isTrendingEligible: true } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ posterUrl: null }, { posterUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ backdropUrl: null }, { backdropUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, isHomeEligible: false } }),
    prisma.movie.findMany({ where: { isPublished: true }, select: { titleRu: true } }),
    prisma.movie.findMany({ where: { isPublished: true, isHomeEligible: false }, include: { genres: { include: { genre: true } } }, orderBy: [{ homeScore: "asc" }, { updatedAt: "desc" }], take: 500 }),
  ]);
  const englishTitles = titleRows.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).length;
  const blockReasons: Record<string, number> = {};
  for (const movie of blockedSample) {
    for (const reason of getQualityBlockReasons(movie)) blockReasons[reason] = (blockReasons[reason] ?? 0) + 1;
  }
  return NextResponse.json({ latestRun, candidateTotal, statuses, movies: { home, hero, trending, missingPoster, missingBackdrop, englishTitles, blocked, blockReasonsSampleSize: blockedSample.length, blockReasons } });
}
