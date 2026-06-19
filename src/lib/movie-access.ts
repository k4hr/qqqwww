import type { Prisma } from "@prisma/client";

export const vibixPublicMovieWhere = {
  isPublished: true,
  vibixAvailable: true,
  AND: [
    { vibixIframeUrl: { not: null } },
    { vibixIframeUrl: { not: "" } },
  ],
  OR: [
    { kinopoiskId: { not: "" } },
    { imdbId: { not: "" } },
  ],
} satisfies Prisma.MovieWhereInput;
