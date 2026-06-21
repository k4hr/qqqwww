import type { Prisma } from "@prisma/client";

export const playableMovieWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
    { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
  ],
};

export const vibixPublicMovieWhere = {
  isPublished: true,
  isCatalogAllowed: true,
  vibixAvailable: true,
  posterUrl: { not: null },
  AND: [playableMovieWhere],
} satisfies Prisma.MovieWhereInput;
