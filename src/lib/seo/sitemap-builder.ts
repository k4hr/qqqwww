import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { siteUrl, watchPath, similarPath } from "@/lib/seo-links";
import { publicCollections } from "@/lib/collections";
import { countryPages, qualityPages, seoTopics } from "@/lib/seo-pages";
import { ContentType } from "@prisma/client";

export const SITEMAP_PAGE_SIZE = 10_000;

type XmlUrl = { loc: string; lastmod?: Date | string; changefreq?: string; priority?: number };
type XmlSitemap = { loc: string; lastmod?: Date | string };

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function date(value?: Date | string) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function urlset(items: XmlUrl[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map((item) => `  <url>\n    <loc>${escapeXml(item.loc)}</loc>${date(item.lastmod) ? `\n    <lastmod>${date(item.lastmod)}</lastmod>` : ""}${item.changefreq ? `\n    <changefreq>${item.changefreq}</changefreq>` : ""}${item.priority ? `\n    <priority>${item.priority.toFixed(1)}</priority>` : ""}\n  </url>`).join("\n")}\n</urlset>`;
}

export function sitemapIndex(items: XmlSitemap[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map((item) => `  <sitemap>\n    <loc>${escapeXml(item.loc)}</loc>${date(item.lastmod) ? `\n    <lastmod>${date(item.lastmod)}</lastmod>` : ""}\n  </sitemap>`).join("\n")}\n</sitemapindex>`;
}

export function xmlResponse(xml: string) {
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}

export async function publicMovieCount(type?: ContentType) {
  return prisma.movie.count({ where: type ? { AND: [vibixPublicMovieWhere, { type }] } : vibixPublicMovieWhere });
}

export async function similarSitemapCount() {
  const rows = await prisma.movieSimilarity.groupBy({
    by: ["sourceMovieId"],
    where: { score: { gte: 140 } },
    _count: { sourceMovieId: true },
    orderBy: { sourceMovieId: "asc" },
  }).catch(() => [] as Array<{ sourceMovieId: string; _count: { sourceMovieId: number } }>);
  return rows.filter((row) => row._count.sourceMovieId >= 4).length;
}

export async function buildSitemapIndexXml() {
  const [movies, series, anime, cartoons, similar] = await Promise.all([
    publicMovieCount(ContentType.MOVIE),
    publicMovieCount(ContentType.SERIES),
    publicMovieCount(ContentType.ANIME),
    publicMovieCount(ContentType.CARTOON),
    similarSitemapCount(),
  ]);
  const items: XmlSitemap[] = [{ loc: siteUrl("/sitemaps/static.xml") }, { loc: siteUrl("/sitemaps/collections.xml") }];
  const add = (kind: string, count: number) => {
    const pages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE));
    for (let page = 1; page <= pages; page++) items.push({ loc: siteUrl(`/sitemaps/${kind}/${page}`) });
  };
  add("movies", movies);
  add("series", series);
  add("anime", anime);
  add("cartoons", cartoons);
  if (similar > 0) add("similar", similar);
  return sitemapIndex(items);
}

export async function buildStaticSitemapXml() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 17 }, (_, i) => currentYear + 1 - i).filter((year) => year >= 2010);
  const urls: XmlUrl[] = [
    { loc: siteUrl("/"), changefreq: "daily", priority: 1 },
    { loc: siteUrl("/films"), changefreq: "daily", priority: .9 },
    { loc: siteUrl("/series"), changefreq: "daily", priority: .9 },
    { loc: siteUrl("/anime"), changefreq: "weekly", priority: .8 },
    { loc: siteUrl("/cartoons"), changefreq: "weekly", priority: .8 },
    { loc: siteUrl("/popular"), changefreq: "daily", priority: .8 },
    { loc: siteUrl("/top-100"), changefreq: "weekly", priority: .8 },
    { loc: siteUrl("/collections"), changefreq: "weekly", priority: .7 },
    ...years.flatMap((year) => [
      { loc: siteUrl(`/year/${year}`), changefreq: "weekly", priority: .7 },
      { loc: siteUrl(`/films/year/${year}`), changefreq: "weekly", priority: .7 },
      { loc: siteUrl(`/series/year/${year}`), changefreq: "weekly", priority: .7 },
      { loc: siteUrl(`/anime/year/${year}`), changefreq: "weekly", priority: .6 },
      { loc: siteUrl(`/cartoons/year/${year}`), changefreq: "weekly", priority: .6 },
    ]),
    ...countryPages.map((page) => ({ loc: siteUrl(`/country/${page.slug}`), changefreq: "weekly", priority: .6 })),
    ...qualityPages.map((page) => ({ loc: siteUrl(`/quality/${page.slug}`), changefreq: "weekly", priority: .5 })),
    ...seoTopics.map((topic) => ({ loc: siteUrl(`/collections/${topic[0]}`), changefreq: "weekly", priority: .7 })),
  ];
  return urlset(urls);
}

export async function buildCollectionSitemapXml() {
  const seoPages = await prisma.seoLandingPage.findMany({ where: { status: "ACTIVE", isIndexable: true, sitemapIncluded: true }, select: { slug: true, updatedAt: true, totalDemand: true }, orderBy: [{ totalDemand: "desc" }, { updatedAt: "desc" }], take: 10_000 }).catch(() => []);
  const urls: XmlUrl[] = [
    ...publicCollections.map((collection) => ({ loc: siteUrl(`/collections/${collection.slug}`), changefreq: "weekly", priority: .7 })),
    ...seoPages.map((page) => ({ loc: siteUrl(`/collections/${page.slug}`), lastmod: page.updatedAt, changefreq: "weekly", priority: page.totalDemand > 100_000 ? .8 : .6 })),
  ];
  const unique = [...new Map(urls.map((item) => [item.loc, item])).values()];
  return urlset(unique);
}

const typeBySitemapKind: Record<string, ContentType> = { movies: ContentType.MOVIE, series: ContentType.SERIES, anime: ContentType.ANIME, cartoons: ContentType.CARTOON };

export async function buildMovieSitemapXml(kind: string, page: number) {
  const type = typeBySitemapKind[kind];
  if (!type) return urlset([]);
  const movies = await prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, { type }] },
    select: { slug: true, updatedAt: true, createdAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: Math.max(0, page - 1) * SITEMAP_PAGE_SIZE,
    take: SITEMAP_PAGE_SIZE,
  });
  return urlset(movies.map((movie) => ({ loc: siteUrl(watchPath(movie)), lastmod: movie.updatedAt ?? movie.createdAt, changefreq: "weekly", priority: .8 })));
}

export async function buildSimilarSitemapXml(page: number) {
  const groups = await prisma.movieSimilarity.groupBy({
    by: ["sourceMovieId"],
    where: { score: { gte: 140 } },
    _count: { sourceMovieId: true },
    orderBy: { sourceMovieId: "asc" },
  }).catch(() => [] as Array<{ sourceMovieId: string; _count: { sourceMovieId: number } }>);
  const ids = groups.filter((row) => row._count.sourceMovieId >= 4).slice(Math.max(0, page - 1) * SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE).map((row) => row.sourceMovieId);
  const movies = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, { id: { in: ids } }] }, select: { slug: true, updatedAt: true } });
  return urlset(movies.map((movie) => ({ loc: siteUrl(similarPath(movie)), lastmod: movie.updatedAt, changefreq: "weekly", priority: .6 })));
}
