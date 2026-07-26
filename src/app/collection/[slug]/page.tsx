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
    <section className="rf-catalog-intro"><div className="rf-section-eyebrow mb-3">Франшиза</div><h1 className="rf-page-title">{baseTitle} все части по порядку</h1><p className="rf-copy mt-4 max-w-3xl">{collectionSeoIntro(baseTitle, parts.length)}</p></section>
    <section className="rf-section"><h2 className="rf-section-title mb-5">Порядок просмотра</h2><div className="movie-grid">{parts.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></section>
    <ol className="rf-section divide-y divide-white/[.07] border-t border-white/[.07]">{parts.map((movie, index) => <li key={movie.id} className="py-5"><h3 className="text-lg font-semibold text-white">{index + 1}. {movie.titleRu} ({movie.year})</h3><p className="line-clamp-3 rf-copy mt-2 max-w-4xl">{movie.description || "Описание скоро появится"}</p><Link href={watchPath(movie)} className="mf-btn mf-btn-primary mt-3">Смотреть</Link></li>)}</ol>
    <section className="rf-section border-t border-white/[.07] pt-6"><h2 className="rf-section-title">Ещё о франшизе</h2><div className="rf-filter-row mt-4"><Link href={similarPath(parts[0])} className="rf-filter">Похожие фильмы</Link>{parts[0].genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="rf-filter">{item.genre.name}</Link>)}{parts.map((movie) => <Link key={movie.id} href={yearPath(movie)} className="rf-filter">Фильмы {movie.year} года</Link>)}{topics.map((topic) => <Link key={topic[0]} href={`/collections/${topic[0]}`} className="rf-filter">{topic[1]}</Link>)}</div></section>
  </div>;
}
