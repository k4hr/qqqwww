import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { countryPageWhere, getCountryPage } from "@/lib/seo-pages";
import { countryPath, genrePath, siteUrl, watchPath } from "@/lib/seo-links";
import { MovieCard } from "@/components/movie-card";
import { JsonLd } from "@/components/json-ld";
import { toTimestamp } from "@/lib/date-utils";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getCountryPage((await params).slug);
  if (!page) return {};
  const title = `Фильмы ${page.name} смотреть онлайн — REDFILM`;
  const description = `Фильмы и сериалы страны ${page.name}: доступные карточки, рейтинги, описания и просмотр онлайн.`;
  return { title, description, alternates: { canonical: countryPath(page.name) } };
}

export default async function CountryPage({ params }: Props) {
  const slug = (await params).slug;
  const page = getCountryPage(slug);
  const where = countryPageWhere(slug);
  if (!page || !where) notFound();
  const movies = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, where] }, include: { genres: { include: { genre: true } } }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 48 });
  if (movies.length < 5) notFound();
  const genres = [...new Map(movies.flatMap((movie) => movie.genres.map((item) => [item.genre.slug, item.genre] as const))).values()].slice(0, 10);
  const years = [...new Set(movies.map((movie) => movie.year))].slice(0, 8);
  const newest = [...movies].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)).slice(0, 6);
  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `Фильмы ${page.name}`, url: siteUrl(countryPath(page.name)), mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)) })) } }} />
    <section className="mf-panel mb-6 p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Фильмы {page.name}</h1><p className="mt-4 max-w-4xl text-[#b7b7c0]">В подборке собраны фильмы и сериалы производства {page.name}, доступные для просмотра на REDFILM.</p><p className="mt-3 max-w-4xl text-[#a1a1aa]">Используйте жанры и годы ниже, чтобы перейти к нужной части каталога без повторного поиска.</p></section>
    <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
    <section className="mf-panel mt-7 p-5 sm:p-6"><h2 className="text-xl font-black text-white">Навигация по фильмам {page.name}</h2><div className="mt-4 flex flex-wrap gap-2">{genres.map((genre) => <Link key={genre.slug} href={genrePath(genre)} className="mf-btn">{genre.name}</Link>)}{years.map((year) => <Link key={year} href={`/year/${year}`} className="mf-btn">{year} год</Link>)}</div><h3 className="mt-6 font-black text-white">Топ страны</h3><div className="mt-3 flex flex-wrap gap-2">{movies.slice(0, 6).map((movie) => <Link key={movie.id} href={watchPath(movie)} className="mf-pill min-h-11">{movie.titleRu}</Link>)}</div><h3 className="mt-6 font-black text-white">Новые фильмы</h3><div className="mt-3 flex flex-wrap gap-2">{newest.map((movie) => <Link key={movie.id} href={watchPath(movie)} className="mf-pill min-h-11">{movie.titleRu}</Link>)}</div></section>
    <nav className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Другие страны"><Link className="mf-pill min-h-11" href="/movies?country=main">Основной каталог</Link><Link className="mf-pill min-h-11" href="/movies?country=all">Все страны</Link></nav>
  </div>;
}
