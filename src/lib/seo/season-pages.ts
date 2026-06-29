import type { Prisma } from "@prisma/client";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere, vibixWatchMovieWhere } from "@/lib/movie-access";
import { normalizeSlug } from "@/lib/seo-slugs";
import { seasonPath } from "@/lib/seo-links";
import { movieSeoInclude, type SeoMovie } from "@/lib/seo-pages";

export type SeasonSeoPage = {
  movie: SeoMovie;
  season: number;
  slug: string;
  maxSeason: number | null;
};

export function parseSeasonSeoSlug(slug: string) {
  const match = slug.match(/^(.+)-([1-9]|1[0-9]|2[0-5])-sezon$/);
  if (!match) return null;
  return { baseSlug: match[1], season: Number(match[2]) };
}

function movieMatchesSeasonSlug(movie: Pick<SeoMovie, "titleRu" | "slug">, baseSlug: string) {
  const titleSlug = normalizeSlug(movie.titleRu);
  return titleSlug === baseSlug || titleSlug.startsWith(`${baseSlug}-`) || movie.slug.startsWith(baseSlug) || baseSlug.startsWith(titleSlug);
}

export async function resolveSeasonSeoPage(slug: string): Promise<SeasonSeoPage | null> {
  const parsed = parseSeasonSeoSlug(slug);
  if (!parsed) return null;

  const candidates = await prisma.movie.findMany({
    where: {
      AND: [
        vibixWatchMovieWhere,
        { type: ContentType.SERIES },
        {
          OR: [
            { slug: { startsWith: parsed.baseSlug } },
            { titleRu: { contains: parsed.baseSlug.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
      ],
    },
    include: movieSeoInclude,
    orderBy: [{ isPublicVisible: "desc" }, { popularScore: "desc" }, { kpRating: "desc" }, { year: "desc" }],
    take: 12,
  });

  const movie = candidates.find((item) => movieMatchesSeasonSlug(item, parsed.baseSlug)) ?? candidates[0] ?? null;
  if (!movie) return null;

  const maxSeason = movie.vibixSeasonCount && movie.vibixSeasonCount > 0 ? movie.vibixSeasonCount : null;
  if (maxSeason && parsed.season > maxSeason) return null;

  return { movie, season: parsed.season, slug: seasonPath(movie, parsed.season).replace("/series/", ""), maxSeason };
}

export function seasonSeoTitle(page: SeasonSeoPage) {
  return `${page.movie.titleRu} ${page.season} сезон смотреть онлайн — REDFILM`;
}

export function seasonSeoDescription(page: SeasonSeoPage) {
  const genres = page.movie.genres.slice(0, 3).map((item) => item.genre.name.toLowerCase()).join(", ");
  return `Смотрите ${page.season} сезон сериала ${page.movie.titleRu} онлайн на REDFILM. ${genres ? `Жанры: ${genres}. ` : ""}Плеер, описание, рейтинги, похожие сериалы и другие сезоны.`;
}

export function availableSeasonNumbers(movie: Pick<SeoMovie, "vibixSeasonCount">) {
  const count = movie.vibixSeasonCount && movie.vibixSeasonCount > 0 ? Math.min(movie.vibixSeasonCount, 25) : 1;
  return Array.from({ length: count }, (_, index) => index + 1);
}

export async function findSeasonSitemapEntries(page: number, pageSize: number) {
  const rows = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { type: ContentType.SERIES, vibixSeasonCount: { gt: 0 } }] },
    select: { slug: true, titleRu: true, vibixSeasonCount: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 50_000,
  });
  const entries = rows.flatMap((movie) => availableSeasonNumbers(movie).map((season) => ({ loc: seasonPath(movie, season), lastmod: movie.updatedAt })));
  const start = Math.max(0, page - 1) * pageSize;
  return entries.slice(start, start + pageSize);
}

export async function countSeasonSitemapEntries() {
  const rows = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { type: ContentType.SERIES, vibixSeasonCount: { gt: 0 } }] },
    select: { vibixSeasonCount: true },
    take: 50_000,
  }).catch(() => [] as Array<{ vibixSeasonCount: number | null }>);
  return rows.reduce((acc, movie) => acc + availableSeasonNumbers(movie).length, 0);
}
