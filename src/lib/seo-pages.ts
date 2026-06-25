import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere, buildCountryFilterWhere } from "@/lib/catalog-filters";
import { baseSlugFromCollectionSlug, buildCollectionSlug, movieSlugFromFilmSeoSlug, normalizeMovieBaseTitle } from "@/lib/seo-slugs";
import { buildSimilarityCandidateWhere, sortSimilarMovies, type SimilarMovieResult } from "@/lib/similar";

export const movieSeoInclude = {
  genres: { include: { genre: true } },
  cast: { include: { person: true }, orderBy: { sortOrder: "asc" as const } },
};

export type SeoMovie = Prisma.MovieGetPayload<{ include: typeof movieSeoInclude }>;

export async function getSeoMovieBySlug(slug: string) {
  return prisma.movie.findFirst({ where: { slug, ...vibixPublicMovieWhere }, include: movieSeoInclude });
}

export async function getSeoMovieByFilmSlug(slug: string) {
  const movieSlug = movieSlugFromFilmSeoSlug(slug);
  return movieSlug ? getSeoMovieBySlug(movieSlug) : null;
}

function parseReasonsJson(value: string | null): string[] {
  if (!value) return ["смысловая похожесть рассчитана REDFILM"];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 6) : ["смысловая похожесть рассчитана REDFILM"];
  } catch {
    return ["смысловая похожесть рассчитана REDFILM"];
  }
}

async function getCachedSimilarSeoMovies(movie: SeoMovie, limit: number): Promise<SimilarMovieResult[]> {
  const cached = await prisma.movieSimilarity.findMany({
    where: { sourceMovieId: movie.id, score: { gte: 180 } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  if (!cached.length) return [];

  const ids = cached.map((item) => item.targetMovieId);
  const movies = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { id: { in: ids } }] },
    include: movieSeoInclude,
  });
  const byId = new Map(movies.map((item) => [item.id, item]));
  const results: SimilarMovieResult[] = [];

  for (const item of cached) {
    const target = byId.get(item.targetMovieId);
    if (!target) continue;

    results.push({
      ...target,
      similarityScore: item.score,
      similarityReasons: parseReasonsJson(item.reasonsJson),
      similarityBucket: item.bucket || undefined,
    });
  }

  // Старые cached similarity могли быть рассчитаны слишком мягко.
  // Перед показом на странице пересчитываем их текущим строгим алгоритмом,
  // чтобы рядом с боевиком не появлялась случайная комедия только из-за общего fallback.
  return sortSimilarMovies(movie, results, limit, 180);
}

export async function findSimilarSeoMovies(movie: SeoMovie, limit = 10) {
  const cached = await getCachedSimilarSeoMovies(movie, limit);
  if (cached.length >= Math.min(limit, 6)) return cached;

  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), buildSimilarityCandidateWhere(movie)] },
    include: movieSeoInclude,
    orderBy: [{ popularScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
    take: 650,
  });
  const ranked = sortSimilarMovies(movie, candidates, limit, 180);
  if (ranked.length >= Math.min(limit, 6)) return ranked;

  const usedIds = [movie.id, ...ranked.map((item) => item.id)];
  const genreIds = movie.genres.map((item) => item.genreId);
  const fallbackCandidates = genreIds.length
    ? await prisma.movie.findMany({
        where: {
          AND: [
            vibixPublicMovieWhere,
            buildDefaultCatalogCountryWhere(),
            { id: { notIn: usedIds }, type: movie.type },
            { genres: { some: { genreId: { in: genreIds } } } },
            { year: { gte: movie.year - 18, lte: movie.year + 18 } },
          ],
        },
        include: movieSeoInclude,
        orderBy: [{ popularScore: "desc" }, { topScore: "desc" }, { kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }],
        take: 420,
      })
    : [];

  // Важное правило: не добиваем блок случайными популярными тайтлами.
  // Если точной смысловой связи нет, лучше показать меньше карточек, чем под
  // «Пчеловодом» вывести «Операцию Ы» или другой нерелевантный фильм.
  const fallbackRanked = sortSimilarMovies(movie, fallbackCandidates, limit - ranked.length, 140);
  return [...ranked, ...fallbackRanked].slice(0, limit);
}

export async function findFranchiseParts(movie: Pick<SeoMovie, "titleRu">) {
  const baseTitle = normalizeMovieBaseTitle(movie.titleRu);
  const baseSlug = buildCollectionSlug(baseTitle).replace(/-vse-chasti$/, "");
  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { slug: { startsWith: baseSlug } }] },
    include: movieSeoInclude,
    orderBy: { year: "asc" },
    take: 50,
  });
  return candidates.filter((item) => normalizeMovieBaseTitle(item.titleRu).toLowerCase() === baseTitle.toLowerCase());
}

export async function findFranchiseByCollectionSlug(slug: string) {
  const baseSlug = baseSlugFromCollectionSlug(slug);
  if (!baseSlug) return [];
  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { slug: { startsWith: baseSlug } }] },
    include: movieSeoInclude,
    orderBy: { year: "asc" },
    take: 50,
  });
  return candidates.filter((item) => buildCollectionSlug(item.titleRu) === slug);
}

export const countryPages = [
  { slug: "ssha", name: "США", filter: "usa" },
  { slug: "velikobritaniya", name: "Великобритания", filter: "uk" },
  { slug: "frantsiya", name: "Франция", filter: "france" },
  { slug: "germaniya", name: "Германия", filter: "germany" },
  { slug: "ispaniya", name: "Испания", filter: "spain" },
  { slug: "italiya", name: "Италия", filter: "italy" },
  { slug: "rossiya", name: "Россия", filter: "russia" },
  { slug: "kitay", name: "Китай", filter: "china" },
  { slug: "yaponiya", name: "Япония", filter: "japan" },
  { slug: "indiya", name: "Индия", filter: "india" },
  { slug: "yuzhnaya-koreya", name: "Южная Корея", filter: "south-korea" },
] as const;

export function getCountryPage(slug: string) { return countryPages.find((item) => item.slug === slug); }
export function countryPageWhere(slug: string) {
  const page = getCountryPage(slug);
  return page ? buildCountryFilterWhere(page.filter) : null;
}

export const qualityPages = [
  { slug: "hd", name: "HD", aliases: ["HD"] },
  { slug: "fullhd", name: "FullHD", aliases: ["FullHD", "Full HD"] },
  { slug: "1080", name: "1080p", aliases: ["1080"] },
] as const;

export function getQualityPage(slug: string) { return qualityPages.find((item) => item.slug === slug); }
export function qualityPageWhere(slug: string): Prisma.MovieWhereInput | null {
  const page = getQualityPage(slug);
  return page ? { OR: page.aliases.map((alias) => ({ quality: { contains: alias, mode: "insensitive" } })) } : null;
}

export const seoTopics = [
  ["marvel", "Фильмы Marvel", ["marvel", "марвел"]],
  ["supergeroi", "Фильмы про супергероев", ["супергер", "superhero", "герой"]],
  ["komiksy", "Фильмы по комиксам", ["комикс", "comic"]],
  ["kosmos", "Фильмы про космос", ["космос", "планет", "галактик"]],
  ["roboty", "Фильмы про роботов", ["робот", "андроид"]],
  ["puteshestviya-vo-vremeni", "Фильмы про путешествия во времени", ["времени", "машина времени"]],
  ["postapokalipsis", "Фильмы про постапокалипсис", ["постапокалип", "конец света"]],
  ["kriminal", "Криминальные фильмы", ["криминал", "преступ"]],
  ["detektivy", "Детективы", ["детектив", "расследован"]],
  ["uzhasy", "Фильмы ужасов", ["ужас", "хоррор"]],
  ["semeynye", "Семейные фильмы", ["семейн", "family"]],
  ["novogodnie", "Новогодние фильмы", ["новогод", "рождеств"]],
  ["voennye", "Военные фильмы", ["военн", "война"]],
  ["sport", "Фильмы про спорт", ["спорт", "чемпион"]],
  ["romantika", "Романтические фильмы", ["романтик", "любов"]],
  ["katastrofy", "Фильмы-катастрофы", ["катастроф", "бедств"]],
] as const;

export function getSeoTopic(slug: string) { return seoTopics.find((item) => item[0] === slug); }
export function topicWhere(slug: string): Prisma.MovieWhereInput | null {
  const topic = getSeoTopic(slug);
  if (!topic) return null;
  return { OR: topic[2].flatMap((keyword) => [
    { titleRu: { contains: keyword, mode: "insensitive" as const } },
    { titleOriginal: { contains: keyword, mode: "insensitive" as const } },
    { description: { contains: keyword, mode: "insensitive" as const } },
    { genres: { some: { genre: { name: { contains: keyword, mode: "insensitive" as const } } } } },
  ]) };
}

export function matchingSeoTopics(movie: Pick<SeoMovie, "titleRu" | "titleOriginal" | "description" | "genres">) {
  const text = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description} ${movie.genres.map((item) => item.genre.name).join(" ")}`.toLowerCase();
  return seoTopics.filter((topic) => topic[2].some((keyword) => text.includes(keyword))).slice(0, 3);
}
