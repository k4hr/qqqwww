import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { notFound } from "next/navigation";
import { PlayerBlock } from "@/components/player-block";
import { VibixBanner } from "@/components/vibix-banner";
import { findFranchiseParts, findSimilarSeoMovies, getSeoMovieBySlug } from "@/lib/seo-pages";
import { countryPath, filmPath, franchisePath, genrePath, likePath, similarPath, watchPath, yearPath } from "@/lib/seo-links";
import { extractCountries } from "@/lib/catalog-filters";
import { MovieCard } from "@/components/movie-card";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await getSeoMovieBySlug(slug);
  if (!movie) return {};
  const title = `Смотреть ${movie.titleRu} (${movie.year}) онлайн — REDFILM`;
  return { title, description: `Онлайн-просмотр ${movie.titleRu} (${movie.year}) в плеере REDFILM.`, alternates: { canonical: watchPath(movie) }, openGraph: { title, description: movie.description, url: watchPath(movie) } };
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const movie = await getSeoMovieBySlug(slug);
  if (!movie) notFound();
  const [similar, parts] = await Promise.all([findSimilarSeoMovies(movie, 6), findFranchiseParts(movie)]);
  const countries = extractCountries(movie.country);

  return (
    <div className="container py-5 sm:py-7">
      <div className="mb-5 flex min-w-0 flex-wrap items-center gap-2 break-words text-sm text-[#7d7d87]">
        <Link href="/" className="hover:text-white">REDFILM</Link><span>/</span>
        <Link href={filmPath(movie)} className="hover:text-white">{movie.titleRu}</Link><span>/</span>
        <span className="text-[#b5b5bd]">Просмотр</span>
      </div>

      <section className="glass-panel section-glow relative overflow-hidden rounded-[26px] p-4 sm:p-6">
        {movie.backdropUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${movie.backdropUrl})` }} /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,9,.98),rgba(6,6,9,.82),rgba(65,0,6,.36))]" />
        <div className="relative grid items-center gap-5 sm:grid-cols-[110px_1fr]">
          <div className="poster-fallback relative hidden aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 sm:block">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="110px" unoptimized /> : <div className="absolute inset-0 flex items-center justify-center text-[#666670]"><Film /></div>}
          </div>
          <div>
            <span className="mf-badge">{movie.quality || "HD"}</span>
            <h1 className="mt-3 break-words text-[clamp(1.5rem,6vw,2.5rem)] font-black tracking-[-.03em] text-white">{movie.titleRu} <span className="font-medium text-[#777781]">({movie.year})</span></h1>
            <p className="line-clamp-2 mt-3 max-w-3xl text-sm leading-relaxed text-[#b9b9c0]">{movie.description}</p>
            <Link href={filmPath(movie)} className="mt-4 inline-flex text-sm font-bold text-[#ff4d55] hover:text-white">Описание фильма</Link>
          </div>
        </div>
      </section>

      <PlayerBlock movie={movie} />
      <section className="mf-panel mt-6 p-5 sm:p-6">
        <h2 className="text-xl font-black text-white">Продолжить знакомство</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={filmPath(movie)} className="mf-btn">Описание фильма</Link>
          <Link href={similarPath(movie)} className="mf-btn">Все похожие</Link>
          <Link href={likePath(movie)} className="mf-btn">Что посмотреть после</Link>
          {parts.length >= 2 ? <Link href={franchisePath(movie)} className="mf-btn">Все части</Link> : null}
          <Link href={yearPath(movie)} className="mf-btn">{movie.year} год</Link>
          {movie.genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}
          {countries.slice(0, 2).map((country) => <Link key={country} href={countryPath(country)} className="mf-btn">{country}</Link>)}
        </div>
      </section>
      <section className="mt-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black text-white">Похожие фильмы</h2><Link href={similarPath(movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link></div><div className="movie-grid">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div></section>
      <VibixBanner size="680x200" />
    </div>
  );
}
