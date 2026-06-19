import type { MetadataRoute } from "next";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { collections } from "@/lib/collections";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const [movies, genres, years] = await Promise.all([
    prisma.movie.findMany({
      where: vibixPublicMovieWhere,
      select: { slug: true, updatedAt: true, year: true, type: true, genres: { select: { genre: { select: { slug: true } } } } },
      take: 5000,
    }),
    prisma.genre.findMany({ select: { slug: true }, take: 500 }),
    prisma.movie.findMany({ where: vibixPublicMovieWhere, select: { year: true }, distinct: ["year"], take: 100 }),
  ]);

  const yearPaths = years
    .map((item) => item.year)
    .filter((year) => year >= 1900 && year <= 2100)
    .flatMap((year) => [
      `/year/${year}`,
      `/movies/${year}`,
      `/series/${year}`,
      `/cartoons/${year}`,
      `/anime/${year}`,
    ]);

  const genreYearSet = new Set<string>();
  for (const movie of movies) {
    for (const item of movie.genres) {
      genreYearSet.add(`/genre/${item.genre.slug}/${movie.year}`);
    }
  }

  const paths = [
    "",
    "/movies",
    "/series",
    "/cartoons",
    "/anime",
    "/latest",
    "/top",
    "/collections",
    ...collections.map((collection) => `/collections/${collection.slug}`),
    ...genres.map((genre) => `/genre/${genre.slug}`),
    ...yearPaths,
    ...Array.from(genreYearSet).slice(0, 3000),
    ...movies.map((movie) => `/movie/${movie.slug}`),
    ...movies.map((movie) => `/watch/${movie.slug}`),
    ...movies.map((movie) => `/similar/${movie.slug}`),
    ...movies.map((movie) => `/f/${movie.slug}`),
  ];

  const uniquePaths = Array.from(new Set(paths));

  return uniquePaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: path.startsWith("/movie/")
      ? (movies.find((movie) => path.endsWith(movie.slug))?.updatedAt ?? new Date())
      : new Date(),
  }));
}
