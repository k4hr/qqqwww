import type { Metadata } from "next";
import Link from "next/link";
import { ContentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";

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
  const [genre, relatedGenres] = await Promise.all([
    prisma.genre.findUnique({ where: { slug } }),
    prisma.genre.findMany({ where: { slug: { not: slug } }, orderBy: { name: "asc" }, take: 12 }),
  ]);
  if (!genre) notFound();
  const count = await prisma.movie.count({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { genres: { some: { genre: { slug } } } }] } });
  if (count < 5) notFound();
  const contentType = type === "SERIES" ? ContentType.SERIES : type === "MOVIE" ? ContentType.MOVIE : undefined;
  return <><ListPage title={`${genre.name} смотреть онлайн`} description={`В каталоге собрано ${count} доступных фильмов и сериалов жанра ${genre.name}. Используйте фильтры по типу, стране и году.`} genreSlug={slug} yearFilter={year} sort={sort} country={country} type={contentType} showCountryFilter showTypeFilter showYearFilter page={Number(page) || 1} /><nav className="container mb-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Похожие жанры">{relatedGenres.map((item) => <Link key={item.id} href={`/genre/${item.slug}`} className="mf-pill min-h-11 shrink-0">{item.name}</Link>)}</nav></>;
}
