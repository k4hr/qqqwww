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

export const catalogPosterWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ posterUrl: { not: null } }, { posterUrl: { not: "" } }] },
    { AND: [{ editorialPosterUrl: { not: null } }, { editorialPosterUrl: { not: "" } }] },
  ],
};

export const vibixPublicMovieWhere = {
  ...vibixWatchMovieWhere,
  isCatalogAllowed: true,
  AND: [playableMovieWhere, catalogPosterWhere],
} satisfies Prisma.MovieWhereInput;
