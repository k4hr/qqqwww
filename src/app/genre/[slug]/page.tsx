import type { Metadata } from "next";
import Link from "next/link";
import { ContentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere, extractCountries } from "@/lib/catalog-filters";
import { countryPath, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; country?: string; type?: string; year?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const genre = await prisma.genre.findUnique({ where: { slug: (await params).slug } });
  if (!genre) return {};
  const title = `${genre.name} смотреть онлайн — REDFILM`;
  const description = `Фильмы и сериалы жанра ${genre.name}: популярные картины, новинки, рейтинги и просмотр онлайн.`;
  return { title, description, alternates: { canonical: `/genre/${genre.slug}` }, openGraph: { title, description, url: `/genre/${genre.slug}` } };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort, country, type, year, page } = await searchParams;
  const [genre, relatedGenres, candidates] = await Promise.all([
    prisma.genre.findUnique({ where: { slug } }),
    prisma.genre.findMany({ where: { slug: { not: slug } }, orderBy: { name: "asc" }, take: 12 }),
    prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { genres: { some: { genre: { slug } } } }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 120 }),
  ]);
  if (!genre) notFound();
  const count = await prisma.movie.count({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { genres: { some: { genre: { slug } } } }] } });
  if (count < 5) notFound();
  const contentType = type === "SERIES" ? ContentType.SERIES : type === "MOVIE" ? ContentType.MOVIE : undefined;
  const popularYears = [...new Set(candidates.map((movie) => movie.year))].slice(0, 8);
  const popularCountries = [...new Set(candidates.flatMap((movie) => extractCountries(movie.country)))].slice(0, 6);
  return <><ListPage title={`${genre.name} смотреть онлайн`} description={[`В разделе собраны фильмы и сериалы жанра ${genre.name.toLowerCase()}, доступные для просмотра на REDFILM.`, `Используйте фильтры по году, стране и типу, чтобы быстрее найти подходящую картину среди ${count} доступных карточек.`]} genreSlug={slug} yearFilter={year} sort={sort} country={country} type={contentType} showCountryFilter showTypeFilter showYearFilter page={Number(page) || 1} /><section className="container mb-8"><div className="mf-panel p-5 sm:p-6"><h2 className="text-xl font-black text-white">Навигация по жанру</h2><div className="mt-4 flex flex-wrap gap-2">{popularYears.map((item) => <Link key={item} href={`/genre/${slug}?year=${item}`} className="mf-btn">{item} год</Link>)}{popularCountries.map((item) => <Link key={item} href={countryPath(item)} className="mf-btn">{item}</Link>)}</div><h3 className="mt-6 font-black text-white">Топ жанра</h3><div className="mt-3 flex flex-wrap gap-2">{candidates.slice(0, 6).map((movie) => <Link key={movie.id} href={watchPath(movie)} className="mf-pill min-h-11">{movie.titleRu}</Link>)}</div><h3 className="mt-6 font-black text-white">Похожие жанры</h3><nav className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{relatedGenres.map((item) => <Link key={item.id} href={`/genre/${item.slug}`} className="mf-pill min-h-11 shrink-0">{item.name}</Link>)}</nav></div></section></>;
}
