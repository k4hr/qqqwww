import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const movies = await prisma.movie.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 5000 });
  const genres = await prisma.genre.findMany({ select: { slug: true }, take: 500 });

  return [
    "",
    "/movies",
    "/series",
    "/cartoons",
    "/anime",
    "/latest",
    "/top",
    ...genres.map((genre) => `/genre/${genre.slug}`),
    ...movies.map((movie) => `/movie/${movie.slug}`),
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: path.startsWith("/movie/") ? (movies.find((movie) => path.endsWith(movie.slug))?.updatedAt ?? new Date()) : new Date(),
  }));
}
