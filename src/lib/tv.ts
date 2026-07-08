import { ContentType, type Prisma } from "@prisma/client";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";
import { normalizeSearchQuery, searchMovies } from "@/lib/search";

const tvMovieInclude = { genres: { include: { genre: true } } } as const;
export type TvMovie = Prisma.MovieGetPayload<{ include: typeof tvMovieInclude }>;

export const TV_REVALIDATE_SECONDS = 300;

const baseTvWhere = {
  AND: [vibixPublicMovieWhere],
} satisfies Prisma.MovieWhereInput;

const topOrder = [{ topScore: "desc" as const }, { kpRating: "desc" as const }, { popularScore: "desc" as const }, { createdAt: "desc" as const }];
const popularOrder = [{ popularScore: "desc" as const }, { homeScore: "desc" as const }, { kpRating: "desc" as const }, { createdAt: "desc" as const }];
const freshOrder = [{ freshScore: "desc" as const }, { vibixUploadedAt: "desc" as const }, { createdAt: "desc" as const }];

export function tvTypeLabel(type: ContentType) {
  if (type === ContentType.SERIES) return "Сериал";
  if (type === ContentType.CARTOON) return "Мультфильм";
  if (type === ContentType.ANIME) return "Аниме";
  return "Фильм";
}

export function tvMoviePath(movie: Pick<TvMovie, "slug">) {
  return `/msx/watch/${movie.slug}`;
}

export function tvPlayerPath(movie: Pick<TvMovie, "slug">) {
  return `/msx/player/${movie.slug}`;
}

export function tvPoster(movie: Pick<TvMovie, "posterUrl" | "backdropUrl">) {
  return movie.posterUrl || movie.backdropUrl || null;
}

export async function getTvMovies(options: {
  type?: ContentType;
  take?: number;
  orderBy?: Prisma.MovieOrderByWithRelationInput[];
  where?: Prisma.MovieWhereInput;
} = {}) {
  const { type, take = 24, orderBy = popularOrder, where } = options;
  return prisma.movie.findMany({
    where: {
      AND: [
        baseTvWhere,
        ...(type ? [{ type }] : []),
        ...(where ? [where] : []),
      ],
    },
    include: tvMovieInclude,
    orderBy,
    take,
  });
}

export async function getTvHome() {
  const [hero, latest, popular, movies, series, cartoons, anime, top] = await Promise.all([
    getTvMovies({ take: 1, orderBy: [{ isHeroEligible: "desc" }, ...popularOrder] }),
    getTvMovies({ take: 18, orderBy: freshOrder }),
    getTvMovies({ take: 24, orderBy: popularOrder }),
    getTvMovies({ type: ContentType.MOVIE, take: 18, orderBy: popularOrder }),
    getTvMovies({ type: ContentType.SERIES, take: 18, orderBy: popularOrder }),
    getTvMovies({ type: ContentType.CARTOON, take: 18, orderBy: popularOrder }),
    getTvMovies({ type: ContentType.ANIME, take: 18, orderBy: popularOrder }),
    getTvMovies({ take: 18, orderBy: topOrder }),
  ]);

  return {
    hero: hero[0] ?? popular[0] ?? latest[0] ?? null,
    sections: [
      { id: "latest", title: "Новинки REDFILM", movies: latest },
      { id: "popular", title: "Популярное", movies: popular },
      { id: "movies", title: "Фильмы", movies },
      { id: "series", title: "Сериалы", movies: series },
      { id: "cartoons", title: "Мультфильмы", movies: cartoons },
      { id: "anime", title: "Аниме", movies: anime },
      { id: "top", title: "Высокий рейтинг", movies: top },
    ].filter((section) => section.movies.length > 0),
  };
}

export async function getTvMovieBySlug(slug: string) {
  return prisma.movie.findFirst({
    where: { AND: [baseTvWhere, { slug }] },
    include: tvMovieInclude,
  });
}

export async function searchTvMovies(query: string, take = 36) {
  const normalized = normalizeSearchQuery(query).slice(0, 120);
  if (!normalized) return [];
  return searchMovies(normalized, { country: "all" }, take);
}

export function serializeTvMovie(movie: TvMovie) {
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.titleRu,
    originalTitle: movie.titleOriginal,
    year: movie.year,
    type: movie.type,
    typeLabel: tvTypeLabel(movie.type),
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    rating: movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating,
    duration: movie.duration,
    country: movie.country,
    genres: movie.genres.map((item) => item.genre.name),
    watchUrl: tvMoviePath(movie),
    playerUrl: tvPlayerPath(movie),
  };
}
