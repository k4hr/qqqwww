import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { countryPageWhere, getCountryPage } from "@/lib/seo-pages";
import { countryPath, filmPath, siteUrl } from "@/lib/seo-links";
import { MovieCard } from "@/components/movie-card";
import { JsonLd } from "@/components/json-ld";

export const dynamic = "force-dynamic";
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
  const movies = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, where] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 48 });
  if (movies.length < 5) notFound();
  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `Фильмы ${page.name}`, url: siteUrl(countryPath(page.name)), mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(filmPath(movie)) })) } }} />
    <section className="mf-panel mb-6 p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Фильмы {page.name}</h1><p className="mt-4 max-w-4xl text-[#b7b7c0]">Каталог фильмов и сериалов производства {page.name}. Даже если страна не входит в основную выдачу REDFILM, её картины доступны на этой тематической странице и через поиск.</p></section>
    <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
    <nav className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Другие страны"><Link className="mf-pill min-h-11" href="/movies?country=main">Основной каталог</Link><Link className="mf-pill min-h-11" href="/movies?country=all">Все страны</Link></nav>
  </div>;
}
