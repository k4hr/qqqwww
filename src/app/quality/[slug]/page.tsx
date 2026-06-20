import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { getQualityPage, qualityPageWhere } from "@/lib/seo-pages";
import { siteUrl, watchPath } from "@/lib/seo-links";
import { MovieCard } from "@/components/movie-card";
import { JsonLd } from "@/components/json-ld";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getQualityPage((await params).slug);
  if (!page) return {};
  const title = `Фильмы в ${page.name} смотреть онлайн — REDFILM`;
  return { title, description: `Подборка фильмов и сериалов, доступных в качестве ${page.name}.`, alternates: { canonical: `/quality/${page.slug}` } };
}

export default async function QualityPage({ params }: Props) {
  const slug = (await params).slug;
  const page = getQualityPage(slug);
  const where = qualityPageWhere(slug);
  if (!page || !where) notFound();
  const movies = await prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), where] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 48 });
  if (movies.length < 20) notFound();
  return <div className="container py-6"><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `Фильмы в ${page.name} качестве`, mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)) })) } }} /><section className="mf-panel mb-6 p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Фильмы в {page.name} качестве</h1><p className="mt-4 text-[#b7b7c0]">Настоящая коллекция доступных фильмов с отметкой качества {page.name}; без отдельных дублей под рекламные формулировки.</p></section><div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></div>;
}
