import { ContentType, type Prisma } from "@prisma/client";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";

const searchInclude = { genres: { include: { genre: true } } } as const;
export type SearchMovie = Prisma.MovieGetPayload<{ include: typeof searchInclude }>;

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function normalizeSearchQuery(query: string) {
  return query.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^a-zа-я0-9]+/gi, " ").trim().replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(query: string) {
  return Array.from(new Set(normalizeSearchQuery(query).split(" ").filter((token) => token.length >= 2)));
}

export function transliterateSearchQuery(query: string) {
  return normalizeSearchQuery(query).split("").map((letter) => transliteration[letter] ?? letter).join("");
}

function tokenWhere(token: string): Prisma.MovieWhereInput {
  const transliterated = transliterateSearchQuery(token);
  const textFields: Prisma.MovieWhereInput[] = [
    { titleRu: { contains: token, mode: "insensitive" } },
    { titleOriginal: { contains: token, mode: "insensitive" } },
    { description: { contains: token, mode: "insensitive" } },
    { country: { contains: token, mode: "insensitive" } },
    { kinopoiskId: { contains: token, mode: "insensitive" } },
    { imdbId: { contains: token, mode: "insensitive" } },
    { genres: { some: { genre: { name: { contains: token, mode: "insensitive" } } } } },
  ];
  if (transliterated !== token) textFields.push({ titleOriginal: { contains: transliterated, mode: "insensitive" } });
  if (/^(19|20)\d{2}$/.test(token)) textFields.push({ year: Number(token) });
  return { OR: textFields };
}

export function buildSearchWhere(query: string): Prisma.MovieWhereInput {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) return {};
  return { OR: tokens.map(tokenWhere) };
}

function editDistance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    let rowMin = previous[0];
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
      rowMin = Math.min(rowMin, previous[j]);
    }
    if (rowMin > 2) return 3;
  }
  return previous[right.length];
}

export function scoreSearchResult(movie: SearchMovie, query: string) {
  const normalized = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(query);
  if (!normalized || !tokens.length) return 0;
  const title = normalizeSearchQuery(movie.titleRu);
  const original = normalizeSearchQuery(movie.titleOriginal ?? "");
  const titleWords = `${title} ${original}`.split(" ").filter(Boolean);
  const searchable = normalizeSearchQuery([
    movie.titleRu, movie.titleOriginal, movie.description, movie.country,
    movie.kinopoiskId, movie.imdbId, movie.year,
    ...movie.genres.map((item) => item.genre.name),
  ].filter(Boolean).join(" "));
  let score = 0;

  if (title === normalized || original === normalized) score += 140;
  else if (title.startsWith(normalized) || original.startsWith(normalized)) score += 95;
  else if (title.includes(normalized) || original.includes(normalized)) score += 75;

  for (const token of tokens) {
    if (titleWords.includes(token)) score += 24;
    else if (titleWords.some((word) => word.startsWith(token) || token.startsWith(word))) score += 15;
    else if (token.length >= 4 && titleWords.some((word) => editDistance(token, word) <= (token.length >= 7 ? 2 : 1))) score += 12;
    else if (searchable.includes(token)) score += 5;
  }
  if (tokens.every((token) => titleWords.some((word) => word === token || editDistance(token, word) <= 2))) score += 35;
  if (tokens.some((token) => token === String(movie.year))) score += 18;
  if (normalized === normalizeSearchQuery(movie.kinopoiskId ?? "") || normalized === normalizeSearchQuery(movie.imdbId ?? "")) score += 120;
  score += Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0);
  return score;
}

export type SearchFilters = { type?: string; year?: string; genre?: string; country?: string };

function filterWhere(filters: SearchFilters, hasQuery: boolean): Prisma.MovieWhereInput {
  const type = Object.values(ContentType).includes(filters.type as ContentType) ? filters.type as ContentType : undefined;
  const year = /^(19|20)\d{2}$/.test(filters.year ?? "") ? Number(filters.year) : undefined;
  return {
    AND: [
      vibixPublicMovieWhere,
      buildCountryFilterWhere(normalizeCatalogCountry(filters.country ?? (hasQuery ? "all" : "main"))),
      ...(type ? [{ type }] : []),
      ...(year ? [{ year }] : []),
      ...(filters.genre ? [{ genres: { some: { genre: { slug: filters.genre } } } }] : []),
    ],
  };
}

export async function searchMovies(query: string, filters: SearchFilters = {}, limit = 48) {
  const normalized = normalizeSearchQuery(query);
  const baseWhere = filterWhere(filters, Boolean(normalized));
  if (!normalized) return [];
  const take = Math.min(240, Math.max(80, limit * 8));
  let candidates = await prisma.movie.findMany({
    where: { AND: [baseWhere, buildSearchWhere(normalized)] },
    include: searchInclude,
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
    take,
  });

  if (candidates.length < Math.min(12, limit)) {
    const fallback = await prisma.movie.findMany({
      where: baseWhere,
      include: searchInclude,
      orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
      take: 240,
    });
    candidates = Array.from(new Map([...candidates, ...fallback].map((movie) => [movie.id, movie])).values());
  }

  return candidates
    .map((movie) => ({ movie, score: scoreSearchResult(movie, normalized) }))
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score || (b.movie.kpRating ?? 0) - (a.movie.kpRating ?? 0))
    .slice(0, limit)
    .map((item) => item.movie);
}
