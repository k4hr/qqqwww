import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [latestRun, statuses, candidateTotal, home, hero, trending, missingPoster, missingBackdrop, blocked, titleRows] = await Promise.all([
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
  ]);
  const englishTitles = titleRows.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).length;
  return NextResponse.json({ latestRun, candidateTotal, statuses, movies: { home, hero, trending, missingPoster, missingBackdrop, englishTitles, blocked } });
}
