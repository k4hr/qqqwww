import { ContentType, Prisma } from "@prisma/client";

export type CollectionDefinition = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  where: Prisma.MovieWhereInput;
  orderBy: Prisma.MovieOrderByWithRelationInput[];
};

const currentYear = new Date().getFullYear();

function genreWhere(names: string[]) {
  return {
    genres: {
      some: {
        genre: {
          name: {
            in: names,
          },
        },
      },
    },
  } satisfies Prisma.MovieWhereInput;
}

export const collections: CollectionDefinition[] = [
  {
    slug: "novinki-kino",
    title: "Новинки кино смотреть онлайн — REDFILM",
    h1: "Новинки кино смотреть онлайн",
    description: "Свежие фильмы и сериалы, которые недавно появились в каталоге REDFILM.",
    where: {},
    orderBy: [{ createdAt: "desc" }],
  },
  {
    slug: "top-100",
    title: "ТОП 100 фильмов и сериалов — REDFILM",
    h1: "ТОП 100 фильмов и сериалов",
    description: "Популярные и рейтинговые фильмы, сериалы, мультфильмы и аниме в каталоге REDFILM.",
    where: {},
    orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }, { views: "desc" }],
  },
  {
    slug: "luchshie-filmy-2026",
    title: "Лучшие фильмы 2026 смотреть онлайн — REDFILM",
    h1: "Лучшие фильмы 2026 смотреть онлайн",
    description: "Фильмы 2026 года с рейтингами, описаниями, трейлерами и карточками.",
    where: { type: ContentType.MOVIE, year: 2026 },
    orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }],
  },
  {
    slug: "filmy-2026",
    title: "Фильмы 2026 смотреть онлайн — REDFILM",
    h1: "Фильмы 2026 смотреть онлайн",
    description: "Новые фильмы 2026 года в каталоге REDFILM.",
    where: { type: ContentType.MOVIE, year: 2026 },
    orderBy: [{ createdAt: "desc" }],
  },
  {
    slug: "serialy-2026",
    title: "Сериалы 2026 смотреть онлайн — REDFILM",
    h1: "Сериалы 2026 смотреть онлайн",
    description: "Сериалы 2026 года с описаниями, рейтингами и трейлерами.",
    where: { type: ContentType.SERIES, year: 2026 },
    orderBy: [{ createdAt: "desc" }],
  },
  {
    slug: "anime-2026",
    title: "Аниме 2026 смотреть онлайн — REDFILM",
    h1: "Аниме 2026 смотреть онлайн",
    description: "Аниме 2026 года в каталоге REDFILM.",
    where: { type: ContentType.ANIME, year: 2026 },
    orderBy: [{ createdAt: "desc" }],
  },
  {
    slug: "multfilmy-2026",
    title: "Мультфильмы 2026 смотреть онлайн — REDFILM",
    h1: "Мультфильмы 2026 смотреть онлайн",
    description: "Мультфильмы 2026 года с описаниями, рейтингами и трейлерами.",
    where: { type: ContentType.CARTOON, year: 2026 },
    orderBy: [{ createdAt: "desc" }],
  },
  {
    slug: "komedii-2026",
    title: "Комедии 2026 смотреть онлайн — REDFILM",
    h1: "Комедии 2026 смотреть онлайн",
    description: "Комедийные фильмы и сериалы 2026 года.",
    where: { year: 2026, ...genreWhere(["комедия", "Комедия"]) },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
  },
  {
    slug: "boeviki-2026",
    title: "Боевики 2026 смотреть онлайн — REDFILM",
    h1: "Боевики 2026 смотреть онлайн",
    description: "Боевики 2026 года в хорошем качестве: карточки, рейтинги и трейлеры.",
    where: { year: 2026, ...genreWhere(["боевик", "Боевик"]) },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
  },
  {
    slug: "uzhasy-2026",
    title: "Ужасы 2026 смотреть онлайн — REDFILM",
    h1: "Ужасы 2026 смотреть онлайн",
    description: "Фильмы ужасов 2026 года с описаниями и рейтингами.",
    where: { year: 2026, ...genreWhere(["ужасы", "Ужасы", "ужас", "Ужас"]) },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
  },
  {
    slug: "fantastika-2026",
    title: "Фантастика 2026 смотреть онлайн — REDFILM",
    h1: "Фантастика 2026 смотреть онлайн",
    description: "Фантастические фильмы и сериалы 2026 года.",
    where: { year: 2026, ...genreWhere(["фантастика", "Фантастика"]) },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
  },
  {
    slug: "filmy-dlya-semi",
    title: "Фильмы для семьи смотреть онлайн — REDFILM",
    h1: "Фильмы для семьи смотреть онлайн",
    description: "Семейные фильмы, мультфильмы и приключения для вечернего просмотра.",
    where: {
      OR: [
        genreWhere(["семейный", "Семейный"]),
        genreWhere(["мультфильм", "Мультфильм"]),
        genreWhere(["приключения", "Приключения"]),
      ],
    },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
  },
];

export function getCollection(slug: string) {
  return collections.find((collection) => collection.slug === slug);
}

const hiddenPublicCollectionSlugs = new Set(["anime-2026", "multfilmy-2026"]);

export const publicCollections = collections.filter(
  (collection) => !hiddenPublicCollectionSlugs.has(collection.slug),
);

export function collectionLinksForYear(year = currentYear) {
  return [
    { href: `/movies/${year}`, label: `Фильмы ${year}` },
    { href: `/series/${year}`, label: `Сериалы ${year}` },
    { href: "/collections/top-100", label: "ТОП 100" },
    { href: "/collections/novinki-kino", label: "Новинки кино" },
  ];
}
