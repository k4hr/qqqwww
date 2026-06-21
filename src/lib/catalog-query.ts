import { ContentType, type Movie, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countryWhere, genreWhere } from "@/lib/catalog-taxonomy";
import { hasCatalogPlayer, hasRussianTitle } from "@/lib/catalog-score";
import { isValidHomePoster } from "@/lib/catalog-safety";

export type CatalogSort = "popular" | "top" | "fresh" | "rating" | "year" | "new" | "catalog";

export type CatalogQueryOptions = {
  type?: ContentType;
  year?: number;
  yearFilter?: string;
  genreSlug?: string;
  countrySlug?: string;
  sort?: string | null;
  page?: number;
  pageSize?: number;
  strict?: "public" | "popular" | "top" | "fresh";
};

export function playableWhere(): Prisma.MovieWhereInput {
  return {
    OR: [
      { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
      { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
    ],
  };
}

export function publicCatalogWhere(): Prisma.MovieWhereInput {
  return {
    isPublished: true,
    isCatalogAllowed: true,
    isPublicVisible: true,
  };
}

export function legacySafeWhere(): Prisma.MovieWhereInput {
  return {
    isPublished: true,
    isCatalogAllowed: true,
    posterUrl: { not: null },
    AND: [playableWhere()],
  };
}

export function yearFilterWhere(year?: number, yearFilter?: string): Prisma.MovieWhereInput {
  if (year) return { year };
  if (!yearFilter) return {};
  if (/^\d{4}$/.test(yearFilter)) return { year: Number(yearFilter) };
  const decade = yearFilter.match(/^(19|20)\d0s$/) ? Number(yearFilter.slice(0, 4)) : null;
  return decade ? { year: { gte: decade, lte: decade + 9 } } : {};
}

function normalizeSort(value?: string | null): CatalogSort {
  if (value === "rating") return "rating";
  if (value === "top") return "top";
  if (value === "fresh" || value === "new" || value === "latest") return "fresh";
  if (value === "year") return "year";
  if (value === "catalog") return "catalog";
  return "popular";
}

export function catalogOrderBy(sort?: string | null): Prisma.MovieOrderByWithRelationInput[] {
  const normalized = normalizeSort(sort);
  if (normalized === "top" || normalized === "rating") return [{ topScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }];
  if (normalized === "fresh") return [{ freshScore: "desc" }, { vibixUploadedAt: "desc" }, { createdAt: "desc" }, { popularScore: "desc" }];
  if (normalized === "year") return [{ year: "desc" }, { popularScore: "desc" }, { catalogScore: "desc" }];
  if (normalized === "catalog") return [{ catalogScore: "desc" }, { popularScore: "desc" }, { createdAt: "desc" }];
  return [{ popularScore: "desc" }, { topScore: "desc" }, { catalogScore: "desc" }, { kpVotes: "desc" }, { imdbVotes: "desc" }];
}

export function buildCatalogWhere(options: CatalogQueryOptions): Prisma.MovieWhereInput {
  const strict = options.strict ?? (normalizeSort(options.sort) === "top" ? "top" : normalizeSort(options.sort) === "fresh" ? "fresh" : "public");
  const base: Prisma.MovieWhereInput = strict === "top"
    ? { isPublished: true, isCatalogAllowed: true, isTopEligible: true }
    : strict === "popular"
      ? { isPublished: true, isCatalogAllowed: true, isPopularEligible: true }
      : strict === "fresh"
        ? { isPublished: true, isCatalogAllowed: true, isFreshEligible: true }
        : publicCatalogWhere();
  return {
    AND: [
      base,
      options.type ? { type: options.type } : {},
      yearFilterWhere(options.year, options.yearFilter),
      genreWhere(options.genreSlug),
      countryWhere(options.countrySlug),
    ],
  };
}

export async function getCatalogMovies(options: CatalogQueryOptions) {
  const safePage = Math.max(1, Math.min(options.page ?? 1, 100));
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 48));
  const where = buildCatalogWhere(options);
  let movies = await prisma.movie.findMany({
    where,
    include: { genres: { include: { genre: true } } },
    orderBy: catalogOrderBy(options.sort),
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  if (!movies.length && safePage === 1) {
    movies = await prisma.movie.findMany({
      where: {
        AND: [
          legacySafeWhere(),
          options.type ? { type: options.type } : {},
          yearFilterWhere(options.year, options.yearFilter),
          genreWhere(options.genreSlug),
          countryWhere(options.countrySlug),
        ],
      },
      include: { genres: { include: { genre: true } } },
      orderBy: catalogOrderBy(options.sort),
      take: pageSize,
    });
    movies = movies.filter((movie) => hasRussianTitle(movie) && isValidHomePoster(movie.posterUrl) && hasCatalogPlayer(movie));
  }

  return movies;
}

export async function getTopCatalogPreview(target: "popular" | "top" | "fresh", type?: ContentType, take = 50) {
  const strict = target === "top" ? "top" : target === "fresh" ? "fresh" : "popular";
  return prisma.movie.findMany({
    where: buildCatalogWhere({ strict, type }),
    orderBy: catalogOrderBy(target),
    take,
    select: {
      id: true,
      slug: true,
      titleRu: true,
      type: true,
      year: true,
      kinopoiskId: true,
      imdbId: true,
      kpRating: true,
      kpVotes: true,
      imdbRating: true,
      imdbVotes: true,
      catalogScore: true,
      popularScore: true,
      topScore: true,
      freshScore: true,
      posterUrl: true,
      backdropUrl: true,
      vibixIframeUrl: true,
      vibixEmbedCode: true,
    },
  });
}
