import type { Prisma } from "@prisma/client";

export const playableMovieWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
    { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
  ],
};

export const vibixWatchMovieWhere = {
  isPublished: true,
  vibixAvailable: true,
  AND: [playableMovieWhere],
} satisfies Prisma.MovieWhereInput;

export const vibixPublicMovieWhere = {
  ...vibixWatchMovieWhere,
  isCatalogAllowed: true,
  posterUrl: { not: null },
} satisfies Prisma.MovieWhereInput;
