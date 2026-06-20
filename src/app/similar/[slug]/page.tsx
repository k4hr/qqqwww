import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { findFranchiseParts, findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";
import { countryPath, franchisePath, genrePath, likePath, similarPath, siteUrl, watchPath, yearPath } from "@/lib/seo-links";
import { similarSeoIntro } from "@/lib/seo-text";
import { extractCountries } from "@/lib/catalog-filters";
import { AnalyticsLink } from "@/components/analytics-link";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) return {};
  const title = `10 фильмов похожих на ${movie.titleRu} — REDFILM`;
  const genres = movie.genres.slice(0, 4).map((item) => item.genre.name.toLowerCase()).join(", ");
  const description = `Подборка фильмов, похожих на ${movie.titleRu}: ${genres || "близкие жанры"}, общая атмосфера, период выхода и рейтинги.`;
  return { title, description, alternates: { canonical: similarPath(movie) }, openGraph: { title, description, url: similarPath(movie) } };
}

export default async function SimilarPage({ params }: Props) {
  const movie = await getSeoMovieBySlug((await params).slug);
  if (!movie) notFound();
  const [similar, franchise] = await Promise.all([findSimilarSeoMovies(movie, 10), findFranchiseParts(movie)]);
  const intro = similarSeoIntro(movie);
  const countries = extractCountries(movie.country);

  return <div className="container py-6">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `Фильмы похожие на ${movie.titleRu}`, url: siteUrl(similarPath(movie)), itemListElement: similar.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.titleRu, url: siteUrl(watchPath(item)), image: item.posterUrl || undefined })) }} />
    <nav className="mb-5 text-sm text-[#85858f]"><Link href="/">REDFILM</Link> / <Link href={watchPath(movie)}>{movie.titleRu}</Link> / Похожие фильмы</nav>
    <section className="mf-panel mb-6 p-5 sm:p-7"><h1 className="text-[clamp(1.8rem,5vw,3rem)] font-black text-white">Фильмы похожие на {movie.titleRu}</h1>{intro.map((text) => <p key={text} className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{text}</p>)}<div className="mt-5 flex flex-wrap gap-2"><Link href={watchPath(movie)} className="mf-btn mf-btn-primary">Смотреть</Link><Link href={likePath(movie)} className="mf-btn">Что посмотреть после</Link>{movie.genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}<Link href={yearPath(movie)} className="mf-btn">{movie.year}</Link>{countries.slice(0, 1).map((country) => <Link key={country} href={countryPath(country)} className="mf-btn">{country}</Link>)}</div></section>
    <section className="mf-panel p-4 sm:p-6"><h2 className="mb-5 text-2xl font-black text-white">Почему эти фильмы похожи</h2><div className="space-y-4">{similar.map((item, index) => <article key={item.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-white/10 pb-4 last:border-0 sm:grid-cols-[90px_minmax(0,1fr)]"><AnalyticsLink eventType="similar_click" movieId={item.id} href={watchPath(item)} className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-xl">{item.posterUrl ? <Image src={item.posterUrl} alt={item.titleRu} fill className="object-cover" sizes="90px" unoptimized /> : null}</AnalyticsLink><div className="min-w-0"><h3 className="text-lg font-black text-white">{index + 1}. <AnalyticsLink eventType="similar_click" movieId={item.id} href={watchPath(item)}>{item.titleRu} ({item.year})</AnalyticsLink></h3><p className="mt-1 text-xs text-[#85858f]">{item.genres.slice(0, 3).map((entry) => entry.genre.name).join(" · ")}</p><p className="line-clamp-2 mt-2 text-sm text-[#a9a9b2]">{item.description}</p><p className="mt-2 text-sm text-[#d0d0d6]"><b>Почему похож:</b> {item.similarityReasons.join("; ")}.</p><div className="mt-3 flex flex-wrap gap-2"><AnalyticsLink eventType="similar_click" movieId={item.id} href={watchPath(item)} className="mf-btn mf-btn-primary">Смотреть</AnalyticsLink></div></div></article>)}</div></section>
    <section className="mf-panel mt-6 p-5 sm:p-6"><h2 className="text-xl font-black text-white">Что ещё посмотреть</h2><div className="mt-4 flex flex-wrap gap-2"><Link href={watchPath(movie)} className="mf-btn mf-btn-primary">Смотреть {movie.titleRu}</Link><Link href={likePath(movie)} className="mf-btn">Что посмотреть после</Link>{movie.genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}<Link href={yearPath(movie)} className="mf-btn">Фильмы {movie.year} года</Link>{countries.slice(0, 1).map((country) => <Link key={country} href={countryPath(country)} className="mf-btn">Фильмы {country}</Link>)}{franchise.length >= 2 ? <Link href={franchisePath(movie)} className="mf-btn">Все части по порядку</Link> : null}</div></section>
  </div>;
}
