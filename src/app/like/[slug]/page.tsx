import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";
import { likePath, similarPath, siteUrl, watchPath } from "@/lib/seo-links";
import { likeSeoIntro } from "@/lib/seo-text";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) return {};
  const title = `Что посмотреть если понравился ${movie.titleRu} — REDFILM`;
  const description = `Что посмотреть после фильма ${movie.titleRu}: подборка картин с близкой атмосферой, жанрами и рейтингами.`;
  return { title, description, alternates: { canonical: likePath(movie) }, openGraph: { title, description, url: likePath(movie) } };
}

export default async function LikePage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  const movies = await findSimilarSeoMovies(movie, 12);
  const intro = likeSeoIntro(movie);
  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `Что посмотреть после ${movie.titleRu}`, url: siteUrl(likePath(movie)), mainEntity: { "@type": "ItemList", itemListElement: movies.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.titleRu, url: siteUrl(watchPath(item)) })) } }} />
    <nav className="mb-5 text-sm text-[#85858f]"><Link href={watchPath(movie)}>{movie.titleRu}</Link> / Что посмотреть после</nav>
    <section className="mf-panel p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Что посмотреть если понравился {movie.titleRu}</h1>{intro.map((text) => <p key={text} className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{text}</p>)}<div className="mt-5 flex gap-3"><Link href={similarPath(movie)} className="mf-btn">Фильмы похожие на {movie.titleRu}</Link></div></section>
    <section className="mt-7"><h2 className="mb-5 text-2xl font-black text-white">Продолжение киновечера</h2><div className="movie-grid">{movies.map((item) => <MovieCard key={item.id} movie={item} />)}</div></section>
  </div>;
}
