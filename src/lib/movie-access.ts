import type { Prisma } from "@prisma/client";

export const vibixPublicMovieWhere = {
  isPublished: true,
  vibixAvailable: true,
  AND: [
    {
      OR: [
        { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
        { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
      ],
    },
  ],
} satisfies Prisma.MovieWhereInput;
