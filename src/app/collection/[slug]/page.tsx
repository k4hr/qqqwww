import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { findFranchiseByCollectionSlug } from "@/lib/seo-pages";
import { collectionSeoIntro } from "@/lib/seo-text";
import { franchisePath, genrePath, similarPath, siteUrl, watchPath } from "@/lib/seo-links";
import { normalizeMovieBaseTitle } from "@/lib/seo-slugs";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parts = await findFranchiseByCollectionSlug((await params).slug);
  if (parts.length < 2) return {};
  const baseTitle = normalizeMovieBaseTitle(parts[0].titleRu);
  const canonical = franchisePath(parts[0]);
  return { title: `${baseTitle} все части по порядку смотреть онлайн — REDFILM`, description: `Все части ${baseTitle} по порядку: годы выхода, описания и ссылки на просмотр.`, alternates: { canonical } };
}

export default async function FranchisePage({ params }: Props) {
  const parts = await findFranchiseByCollectionSlug((await params).slug);
  if (parts.length < 2) notFound();
  const baseTitle = normalizeMovieBaseTitle(parts[0].titleRu);
  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `${baseTitle} все части по порядку`, itemListElement: parts.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) }} />
    <nav className="mb-5 text-sm text-[#85858f]"><Link href="/">REDFILM</Link> / Все части</nav>
    <section className="mf-panel p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">{baseTitle} все части по порядку</h1><p className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{collectionSeoIntro(baseTitle, parts.length)}</p></section>
    <section className="mt-7"><h2 className="mb-5 text-2xl font-black text-white">Порядок просмотра</h2><div className="movie-grid">{parts.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></section>
    <div className="mt-6 flex flex-wrap gap-3">{parts.map((movie, index) => <Link key={movie.id} href={watchPath(movie)} className="mf-btn">{index + 1}. Смотреть {movie.titleRu}</Link>)}<Link href={similarPath(parts[0])} className="mf-btn">Похожие фильмы</Link>{parts[0].genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}</div>
  </div>;
}
