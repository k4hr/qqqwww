import type { Metadata } from "next";
import { ContentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ sort?: string; country?: string; type?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const year = (await params).year;
  const title = `Фильмы ${year} года смотреть онлайн — REDFILM`;
  const description = `Фильмы и сериалы ${year} года: описания, рейтинги, жанры, страны и ссылки на онлайн-просмотр.`;
  return { title, description, alternates: { canonical: `/year/${year}` }, openGraph: { title, description, url: `/year/${year}` } };
}

export default async function YearPage({ params, searchParams }: Props) {
  const parsedYear = Number((await params).year);
  if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 2100) notFound();
  const { sort, country, type, page } = await searchParams;
  const count = await prisma.movie.count({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { year: parsedYear }] } });
  if (count < 5) notFound();
  const contentType = type === "SERIES" ? ContentType.SERIES : type === "MOVIE" ? ContentType.MOVIE : undefined;
  return <ListPage title={`Фильмы ${parsedYear} года`} description={`Доступные фильмы и сериалы ${parsedYear} года. В каталоге ${count} карточек с описаниями, рейтингами и ссылками на просмотр.`} year={parsedYear} sort={sort} country={country} type={contentType} showCountryFilter showTypeFilter page={Number(page) || 1} />;
}
