import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere, buildCountryFilterWhere } from "@/lib/catalog-filters";
import { baseSlugFromCollectionSlug, buildCollectionSlug, movieSlugFromFilmSeoSlug, normalizeMovieBaseTitle } from "@/lib/seo-slugs";
import { sortSimilarMovies } from "@/lib/similar";

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

export async function findSimilarSeoMovies(movie: SeoMovie, limit = 10) {
  const genreIds = movie.genres.map((item) => item.genreId);
  const candidates = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), {
      id: { not: movie.id },
      OR: [
        { type: movie.type },
        { year: { gte: movie.year - 6, lte: movie.year + 6 } },
        ...(genreIds.length ? [{ genres: { some: { genreId: { in: genreIds } } } }] : []),
      ],
    }] },
    include: movieSeoInclude,
    take: 100,
  });
  const ranked = sortSimilarMovies(movie, candidates, limit);
  if (ranked.length >= limit) return ranked;

  const usedIds = [movie.id, ...ranked.map((item) => item.id)];
  const fallback = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { id: { notIn: usedIds } }] },
    include: movieSeoInclude,
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
    take: limit - ranked.length,
  });
  return [...ranked, ...fallback.map((item) => ({ ...item, similarityScore: 1, similarityReasons: ["популярно в каталоге REDFILM"] }))];
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
