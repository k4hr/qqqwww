import { ContentType, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const playableWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
    { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
  ],
};

const baseWhere: Prisma.MovieWhereInput = { isPublished: true, isCatalogAllowed: true };

const select = {
  id: true,
  slug: true,
  titleRu: true,
  year: true,
  type: true,
  homeScore: true,
  qualityScore: true,
  trendScore: true,
  isHomeEligible: true,
  isHeroEligible: true,
  posterUrl: true,
  backdropUrl: true,
  vibixIframeUrl: true,
  vibixEmbedCode: true,
  kpRating: true,
  kpVotes: true,
  imdbRating: true,
  imdbVotes: true,
};

function compact<T extends { vibixIframeUrl: string | null; vibixEmbedCode: string | null; posterUrl: string | null; backdropUrl: string | null }>(movie: T) {
  return {
    ...movie,
    poster: Boolean(movie.posterUrl?.trim()),
    backdrop: Boolean(movie.backdropUrl?.trim()),
    iframe: Boolean(movie.vibixIframeUrl?.trim()),
    embedCode: Boolean(movie.vibixEmbedCode?.trim()),
    posterUrl: undefined,
    backdropUrl: undefined,
    vibixIframeUrl: undefined,
    vibixEmbedCode: undefined,
  };
}

export async function GET() {
  const [hero, movies, series, fallback, counts] = await Promise.all([
    prisma.movie.findMany({ where: { ...baseWhere, isHeroEligible: true }, orderBy: [{ homeScore: "desc" }], take: 12, select }),
    prisma.movie.findMany({ where: { ...baseWhere, isHomeEligible: true, type: ContentType.MOVIE }, orderBy: [{ homeScore: "desc" }], take: 12, select }),
    prisma.movie.findMany({ where: { ...baseWhere, isHomeEligible: true, type: ContentType.SERIES }, orderBy: [{ homeScore: "desc" }], take: 12, select }),
    prisma.movie.findMany({ where: { ...baseWhere, ...playableWhere, posterUrl: { not: null } }, orderBy: [{ homeScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }], take: 12, select }),
    Promise.all([
      prisma.movie.count({ where: baseWhere }),
      prisma.movie.count({ where: { ...baseWhere, isHomeEligible: true } }),
      prisma.movie.count({ where: { ...baseWhere, isHeroEligible: true } }),
      prisma.movie.count({ where: { ...baseWhere, ...playableWhere } }),
      prisma.movie.count({ where: { ...baseWhere, ...playableWhere, posterUrl: { not: null } } }),
    ]),
  ]);

  return NextResponse.json({
    counts: {
      publishedCatalog: counts[0],
      homeEligibleVisible: counts[1],
      heroEligibleVisible: counts[2],
      playableVisible: counts[3],
      playableWithPosterVisible: counts[4],
    },
    hero: hero.map(compact),
    popularMovies: movies.map(compact),
    popularSeries: series.map(compact),
    fallback: fallback.map(compact),
  });
}
