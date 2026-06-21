import { ContentType, type Movie, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countryWhere, genreWhere } from "@/lib/catalog-taxonomy";
import { hasCatalogPlayer, hasRussianTitle } from "@/lib/catalog-score";
import { isValidHomePoster } from "@/lib/catalog-safety";
import { classifyCatalogKind } from "@/lib/catalog-kind";

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

function applyStrictTypeFilter<T extends Movie & { genres?: { genre: { name?: string | null; slug?: string | null } }[] }>(movies: T[], type?: ContentType) {
  if (type !== ContentType.ANIME && type !== ContentType.CARTOON) return movies;
  return movies.filter((movie) => classifyCatalogKind(movie) === type);
}

function strictTypeFetchMultiplier(type?: ContentType) {
  if (type === ContentType.ANIME) return 8;
  if (type === ContentType.CARTOON) return 3;
  return 1;
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
  const fetchMultiplier = strictTypeFetchMultiplier(options.type);
  const fetchSize = pageSize * fetchMultiplier;
  let movies = await prisma.movie.findMany({
    where,
    include: { genres: { include: { genre: true } } },
    orderBy: catalogOrderBy(options.sort),
    skip: (safePage - 1) * fetchSize,
    take: fetchSize,
  });
  movies = applyStrictTypeFilter(movies, options.type).slice(0, pageSize);

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
      take: fetchSize,
    });
    movies = applyStrictTypeFilter(movies, options.type)
      .filter((movie) => hasRussianTitle(movie) && isValidHomePoster(movie.posterUrl) && hasCatalogPlayer(movie))
      .slice(0, pageSize);
  }

  return movies;
}

export async function getTopCatalogPreview(target: "popular" | "top" | "fresh", type?: ContentType, take = 50) {
  const strict = target === "top" ? "top" : target === "fresh" ? "fresh" : "popular";
  const fetchSize = take * strictTypeFetchMultiplier(type);
  const movies = await prisma.movie.findMany({
    where: buildCatalogWhere({ strict, type }),
    include: { genres: { include: { genre: true } } },
    orderBy: catalogOrderBy(target),
    take: fetchSize,
  });

  return applyStrictTypeFilter(movies, type).slice(0, take).map((movie) => ({
    id: movie.id,
    slug: movie.slug,
    titleRu: movie.titleRu,
    type: movie.type,
    year: movie.year,
    kinopoiskId: movie.kinopoiskId,
    imdbId: movie.imdbId,
    kpRating: movie.kpRating,
    kpVotes: movie.kpVotes,
    imdbRating: movie.imdbRating,
    imdbVotes: movie.imdbVotes,
    catalogScore: movie.catalogScore,
    popularScore: movie.popularScore,
    topScore: movie.topScore,
    freshScore: movie.freshScore,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    vibixIframeUrl: movie.vibixIframeUrl,
    vibixEmbedCode: movie.vibixEmbedCode,
  }));
}
