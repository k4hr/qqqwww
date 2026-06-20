import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { buildCollectionSlug } from "@/lib/seo-slugs";
import { countryPages, countryPageWhere, qualityPages, qualityPageWhere, seoTopics, topicWhere } from "@/lib/seo-pages";
import { similarPath, siteUrl, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const movies = await prisma.movie.findMany({
    where: vibixPublicMovieWhere,
    select: { id: true, slug: true, titleRu: true, updatedAt: true, year: true, isCatalogAllowed: true, genres: { select: { genre: { select: { slug: true } } } } },
    take: 5000,
  });
  const mainMovies = movies.filter((movie) => movie.isCatalogAllowed);

  const genreCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const franchiseCounts = new Map<string, number>();
  for (const movie of mainMovies) {
    yearCounts.set(movie.year, (yearCounts.get(movie.year) ?? 0) + 1);
    for (const item of movie.genres) genreCounts.set(item.genre.slug, (genreCounts.get(item.genre.slug) ?? 0) + 1);
  }
  for (const movie of movies) {
    const slug = buildCollectionSlug(movie.titleRu);
    franchiseCounts.set(slug, (franchiseCounts.get(slug) ?? 0) + 1);
  }

  const countryAvailability = await Promise.all(countryPages.map(async (page) => {
    const where = countryPageWhere(page.slug)!;
    const rows = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, where] }, select: { id: true }, take: 5 });
    return rows.length >= 5 ? page.slug : null;
  }));
  const qualityAvailability = await Promise.all(qualityPages.map(async (page) => {
    const where = qualityPageWhere(page.slug)!;
    const rows = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), where] }, select: { id: true }, take: 20 });
    return rows.length >= 20 ? page.slug : null;
  }));
  const topicAvailability = await Promise.all(seoTopics.map(async (topic) => {
    const where = topicWhere(topic[0])!;
    const rows = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), where] }, select: { id: true }, take: 8 });
    return rows.length >= 8 ? topic[0] : null;
  }));

  const staticPaths = ["", "/movies", "/series", "/latest", "/top", "/collections"];
  const paths = [
    ...staticPaths,
    ...movies.flatMap((movie) => [watchPath(movie), similarPath(movie)]),
    ...Array.from(franchiseCounts).filter(([, count]) => count >= 2).map(([slug]) => `/collection/${slug}`),
    ...Array.from(genreCounts).filter(([, count]) => count >= 5).map(([slug]) => `/genre/${slug}`),
    ...Array.from(yearCounts).filter(([, count]) => count >= 5).map(([year]) => `/year/${year}`),
    ...countryAvailability.flatMap((slug) => slug ? [`/country/${slug}`] : []),
    ...qualityAvailability.flatMap((slug) => slug ? [`/quality/${slug}`] : []),
    ...topicAvailability.flatMap((slug) => slug ? [`/collections/${slug}`] : []),
  ];
  const updatedBySlug = new Map(movies.map((movie) => [movie.slug, movie.updatedAt]));

  return Array.from(new Set(paths)).map((path) => {
    const movieSlug = path.match(/^\/(?:watch|similar)\/(.+)$/)?.[1];
    return { url: siteUrl(path), lastModified: movieSlug ? updatedBySlug.get(movieSlug) ?? new Date() : new Date() };
  });
}

const getCachedSitemap = unstable_cache(buildSitemap, ["redfilm-seo-sitemap-v3"], { revalidate: 3600 });

export default function sitemap() {
  return getCachedSitemap();
}
