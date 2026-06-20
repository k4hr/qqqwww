import type { Metadata } from "next";
import Link from "next/link";
import { ContentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { genrePath, watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ sort?: string; country?: string; type?: string; genre?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const year = (await params).year;
  const title = `Фильмы ${year} года смотреть онлайн — REDFILM`;
  const description = `Фильмы и сериалы ${year} года: описания, рейтинги, жанры, страны и ссылки на онлайн-просмотр.`;
  return { title, description, alternates: { canonical: `/year/${year}` }, openGraph: { title, description, url: `/year/${year}` } };
}

export default async function YearPage({ params, searchParams }: Props) {
  const parsedYear = Number((await params).year);
  if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 2100) notFound();
  const { sort, country, type, genre, page } = await searchParams;
  const yearWhere = { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { year: parsedYear }] };
  const [count, candidates] = await Promise.all([
    prisma.movie.count({ where: yearWhere }),
    prisma.movie.findMany({ where: yearWhere, include: { genres: { include: { genre: true } } }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 120 }),
  ]);
  if (count < 5) notFound();
  const contentType = type === "SERIES" ? ContentType.SERIES : type === "MOVIE" ? ContentType.MOVIE : undefined;
  const genres = [...new Map(candidates.flatMap((movie) => movie.genres.map((item) => [item.genre.slug, item.genre] as const))).values()].slice(0, 10);
  return <><ListPage title={`Фильмы ${parsedYear} года`} description={[`На этой странице собраны фильмы и сериалы ${parsedYear} года, доступные на REDFILM.`, `Можно выбрать жанр, страну и тип контента среди ${count} карточек, а затем перейти прямо к просмотру.`]} year={parsedYear} filterGenreSlug={genre} sort={sort} country={country} type={contentType} showCountryFilter showTypeFilter showGenreFilter page={Number(page) || 1} /><section className="container mb-8"><div className="mf-panel p-5 sm:p-6"><h2 className="text-xl font-black text-white">Популярное в {parsedYear} году</h2><div className="mt-4 flex flex-wrap gap-2">{genres.map((item) => <Link key={item.slug} href={`${genrePath(item)}?year=${parsedYear}`} className="mf-btn">{item.name}</Link>)}<Link href={`/year/${parsedYear}?country=usa&type=MOVIE`} className="mf-btn">Фильмы США</Link><Link href={`/year/${parsedYear}?type=SERIES`} className="mf-btn">Сериалы {parsedYear}</Link></div><div className="mt-5 flex flex-wrap gap-2">{candidates.slice(0, 6).map((movie) => <Link key={movie.id} href={watchPath(movie)} className="mf-pill min-h-11">{movie.titleRu}</Link>)}</div></div></section></>;
}
