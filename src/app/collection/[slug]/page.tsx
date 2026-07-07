import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { findFranchiseByCollectionSlug, matchingSeoTopics } from "@/lib/seo-pages";
import { collectionSeoIntro } from "@/lib/seo-text";
import { franchisePath, genrePath, similarPath, siteUrl, watchPath, yearPath } from "@/lib/seo-links";
import { normalizeMovieBaseTitle } from "@/lib/seo-slugs";

export const revalidate = 1800;

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
  const topics = matchingSeoTopics(parts[0]);
  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `${baseTitle} все части по порядку`, itemListElement: parts.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) }} />
    <nav className="mb-5 text-sm text-[#85858f]"><Link href="/">REDFILM</Link> / Все части</nav>
    <section className="mf-panel p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">{baseTitle} все части по порядку</h1><p className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{collectionSeoIntro(baseTitle, parts.length)}</p></section>
    <section className="mt-7"><h2 className="mb-5 text-2xl font-black text-white">Порядок просмотра</h2><div className="movie-grid">{parts.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></section>
    <ol className="mf-panel mt-6 space-y-4 p-5 sm:p-6">{parts.map((movie, index) => <li key={movie.id} className="border-b border-white/10 pb-4 last:border-0 last:pb-0"><h3 className="text-lg font-black text-white">{index + 1}. {movie.titleRu} ({movie.year})</h3><p className="line-clamp-3 mt-2 text-sm leading-relaxed text-[#a9a9b2]">{movie.description || "Описание скоро появится"}</p><Link href={watchPath(movie)} className="mf-btn mf-btn-primary mt-3">Смотреть</Link></li>)}</ol>
    <section className="mf-panel mt-6 p-5 sm:p-6"><h2 className="text-xl font-black text-white">Ещё о франшизе</h2><div className="mt-4 flex flex-wrap gap-3"><Link href={similarPath(parts[0])} className="mf-btn">Похожие фильмы</Link>{parts[0].genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}{parts.map((movie) => <Link key={movie.id} href={yearPath(movie)} className="mf-btn">Фильмы {movie.year} года</Link>)}{topics.map((topic) => <Link key={topic[0]} href={`/collections/${topic[0]}`} className="mf-btn">{topic[1]}</Link>)}</div></section>
  </div>;
}
