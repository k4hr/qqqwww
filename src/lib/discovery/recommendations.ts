import "server-only";

import { ContentType, type Prisma } from "@prisma/client";
import { type DiscoveryMood, normalizeDiscoveryMood } from "@/lib/discovery/types";
import { playableMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";

export const discoveryMovieSelect = {
  id: true,
  slug: true,
  titleRu: true,
  year: true,
  type: true,
  posterUrl: true,
  quality: true,
  kpRating: true,
  imdbRating: true,
  description: true,
  country: true,
  homeScore: true,
  trendScore: true,
} satisfies Prisma.MovieSelect;

export type DiscoveryMovie = Prisma.MovieGetPayload<{ select: typeof discoveryMovieSelect }>;

const moodGenres: Record<DiscoveryMood, string[]> = {
  evening: [],
  action: ["boeviki", "trillery", "fantastika", "priklyucheniya"],
  comfort: ["komedii", "semeynye", "priklyucheniya", "fentezi"],
  deep: ["dramy", "detektivy", "kriminal", "istoricheskie"],
  new: [],
};

export async function getDiscoveryRecommendations({ mood = "evening", limit = 10 }: { mood?: DiscoveryMood; limit?: number } = {}) {
  const currentYear = new Date().getFullYear();
  const normalizedMood = normalizeDiscoveryMood(mood);
  const genres = moodGenres[normalizedMood];
  const take = Math.min(Math.max(limit, 4), 18);
  const where: Prisma.MovieWhereInput = {
    isPublished: true,
    isCatalogAllowed: true,
    posterUrl: { not: null },
    AND: [
      playableMovieWhere,
      ...(genres.length ? [{ genres: { some: { genre: { slug: { in: genres } } } } }] : []),
      ...(normalizedMood === "new" ? [{ year: { gte: currentYear - 2 } }] : []),
    ],
  };

  return prisma.movie.findMany({
    where,
    select: discoveryMovieSelect,
    orderBy: normalizedMood === "new"
      ? [{ freshScore: "desc" }, { vibixUploadedAt: "desc" }, { trendScore: "desc" }, { homeScore: "desc" }]
      : [{ homeScore: "desc" }, { trendScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }, { kpRating: "desc" }],
    take,
  });
}

export async function getMatchCandidates({ limit = 36, type }: { limit?: number; type?: ContentType } = {}) {
  const take = Math.min(Math.max(limit, 12), 60);
  return prisma.movie.findMany({
    where: {
      isPublished: true,
      isCatalogAllowed: true,
      posterUrl: { not: null },
      AND: [playableMovieWhere, ...(type ? [{ type }] : [])],
    },
    select: discoveryMovieSelect,
    orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }, { qualityScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }],
    take,
  });
}

export { ContentType };
