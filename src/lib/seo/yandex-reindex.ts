import type { Movie, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { playableMovieWhere } from "@/lib/movie-access";
import { publicCollections } from "@/lib/collections";
import { seoTopics } from "@/lib/seo-pages";
import { similarPath, siteUrl, watchPath } from "@/lib/seo-links";

export type YandexReindexGroupName =
  | "WATCH TOP"
  | "WATCH NEW"
  | "SIMILAR"
  | "COLLECTIONS"
  | "TAXONOMY";

export type YandexReindexGroup = {
  name: YandexReindexGroupName;
  urls: string[];
};

export type YandexReindexList = {
  generatedAt: Date;
  groups: YandexReindexGroup[];
  text: string;
  total: number;
};

type UrlMovie = Pick<Movie, "slug">;

const publicWatchWhere = {
  isPublished: true,
  isCatalogAllowed: true,
  posterUrl: { not: null },
  titleRu: { not: "" },
  AND: [
    playableMovieWhere,
    { posterUrl: { not: "" } },
  ],
} satisfies Prisma.MovieWhereInput;

const forbiddenPathMarkers = [
  "/admin",
  "/api",
  "/favorites",
  "/history",
  "/sitemap",
  "/robots",
];

const collectionPaths = [
  "/collections/filmy-smotret-online",
  "/collections/serialy-smotret-online",
  "/collections/multfilmy-smotret-online",
  "/collections/anime-smotret-online",
];

const taxonomyPaths = [
  "/genre/boevik",
  "/genre/triller",
  "/genre/fantastika",
  "/genre/drama",
  "/genre/uzhasy",
  "/year/2026",
  "/year/2025",
  "/year/2024",
  "/country/ssha",
  "/country/rossiya",
];

function isAllowedPublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    return !forbiddenPathMarkers.some((marker) => parsed.pathname.startsWith(marker));
  } catch {
    return false;
  }
}

function toAbsolute(path: string) {
  return siteUrl(path);
}

function addUnique(target: string[], seen: Set<string>, candidates: string[], limit: number) {
  for (const url of candidates) {
    if (target.length >= limit) break;
    if (!isAllowedPublicUrl(url) || seen.has(url)) continue;
    seen.add(url);
    target.push(url);
  }
}

function watchUrls(movies: UrlMovie[]) {
  return movies.map((movie) => toAbsolute(watchPath(movie)));
}

async function getWatchTopUrls(seen: Set<string>) {
  const movies = await prisma.movie.findMany({
    where: publicWatchWhere,
    select: { slug: true },
    orderBy: [
      { homeScore: "desc" },
      { trendScore: "desc" },
      { kpRating: "desc" },
      { imdbRating: "desc" },
      { views: "desc" },
      { year: "desc" },
    ],
    take: 160,
  });
  const urls: string[] = [];
  addUnique(urls, seen, watchUrls(movies), 70);
  return urls;
}

async function getWatchNewUrls(seen: Set<string>) {
  const movies = await prisma.movie.findMany({
    where: {
      AND: [
        publicWatchWhere,
        { vibixAvailable: true },
      ],
    },
    select: { slug: true },
    orderBy: [
      { vibixUploadedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 180,
  });
  const urls: string[] = [];
  addUnique(urls, seen, watchUrls(movies), 30);
  return urls;
}

async function getSimilarUrls(seen: Set<string>) {
  const links = await prisma.movieSimilarity.findMany({
    select: { sourceMovieId: true, score: true },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 10_000,
  });

  const grouped = new Map<string, { count: number; score: number }>();
  for (const link of links) {
    const current = grouped.get(link.sourceMovieId) ?? { count: 0, score: 0 };
    current.count += 1;
    current.score = Math.max(current.score, link.score);
    grouped.set(link.sourceMovieId, current);
  }

  const sourceIds = [...grouped.entries()]
    .filter(([, item]) => item.count >= 5)
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count)
    .map(([id]) => id)
    .slice(0, 300);

  if (!sourceIds.length) return [];

  const movies = await prisma.movie.findMany({
    where: {
      AND: [
        publicWatchWhere,
        { id: { in: sourceIds } },
      ],
    },
    select: {
      id: true,
      slug: true,
      homeScore: true,
      trendScore: true,
      kpRating: true,
      imdbRating: true,
      views: true,
      year: true,
    },
    take: 300,
  });

  const sourcePosition = new Map(sourceIds.map((id, index) => [id, index]));
  const sorted = movies.sort((a, b) => {
    const scoreDelta =
      b.homeScore - a.homeScore ||
      b.trendScore - a.trendScore ||
      (b.kpRating ?? 0) - (a.kpRating ?? 0) ||
      (b.imdbRating ?? 0) - (a.imdbRating ?? 0) ||
      b.views - a.views ||
      b.year - a.year;
    if (scoreDelta !== 0) return scoreDelta;
    return (sourcePosition.get(a.id) ?? 9999) - (sourcePosition.get(b.id) ?? 9999);
  });

  const urls: string[] = [];
  addUnique(urls, seen, sorted.map((movie) => toAbsolute(similarPath(movie))), 25);
  return urls;
}

async function getCollectionUrls(seen: Set<string>) {
  const activeSeoPages = await prisma.seoLandingPage.findMany({
    where: { status: "ACTIVE", isIndexable: true },
    select: { slug: true },
    orderBy: [{ totalDemand: "desc" }, { updatedAt: "desc" }],
    take: 30,
  }).catch(() => []);

  const paths = [
    ...collectionPaths,
    ...publicCollections.map((collection) => `/collections/${collection.slug}`),
    ...seoTopics.map((topic) => `/collections/${topic[0]}`),
    ...activeSeoPages.map((page) => `/collections/${page.slug}`),
  ];

  const urls: string[] = [];
  addUnique(urls, seen, paths.map(toAbsolute), 15);
  return urls;
}

function getTaxonomyUrls(seen: Set<string>) {
  const urls: string[] = [];
  addUnique(urls, seen, taxonomyPaths.map(toAbsolute), 10);
  return urls;
}

function formatGroups(groups: YandexReindexGroup[]) {
  return groups
    .map((group) => [`# ${group.name}`, ...group.urls].join("\n"))
    .join("\n\n");
}

export async function generateYandexReindexList(): Promise<YandexReindexList> {
  const seen = new Set<string>();
  const groups: YandexReindexGroup[] = [
    { name: "WATCH TOP", urls: await getWatchTopUrls(seen) },
    { name: "WATCH NEW", urls: await getWatchNewUrls(seen) },
    { name: "SIMILAR", urls: await getSimilarUrls(seen) },
    { name: "COLLECTIONS", urls: await getCollectionUrls(seen) },
    { name: "TAXONOMY", urls: getTaxonomyUrls(seen) },
  ];

  const text = formatGroups(groups);
  return {
    generatedAt: new Date(),
    groups,
    text,
    total: groups.reduce((sum, group) => sum + group.urls.length, 0),
  };
}
