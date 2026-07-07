import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { PlayerBlock } from "@/components/player-block";
import { findSimilarSeoMovies } from "@/lib/seo-pages";
import { availableSeasonNumbers, resolveSeasonSeoPage, seasonSeoDescription, seasonSeoTitle } from "@/lib/seo/season-pages";
import { breadcrumbJsonLd, itemListJsonLd, movieJsonLd, videoObjectJsonLd } from "@/lib/seo/schema";
import { genrePath, seasonPath, similarPath, watchPath } from "@/lib/seo-links";


export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await resolveSeasonSeoPage((await params).slug);
  if (!page) return {};
  const canonical = seasonPath(page.movie, page.season);
  const title = seasonSeoTitle(page);
  const description = seasonSeoDescription(page);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: page.movie.backdropUrl || page.movie.posterUrl ? [{ url: page.movie.backdropUrl || page.movie.posterUrl! }] : undefined },
  };
}

export default async function SeriesSeasonPage({ params }: Props) {
  const page = await resolveSeasonSeoPage((await params).slug);
  if (!page) notFound();

  const canonicalSlug = seasonPath(page.movie, page.season).replace("/series/", "");
  if (page.slug !== canonicalSlug) permanentRedirect(seasonPath(page.movie, page.season));

  const similar = await findSimilarSeoMovies(page.movie, 12);
  const seasons = availableSeasonNumbers(page.movie);
  const h1 = `${page.movie.titleRu} ${page.season} сезон смотреть онлайн`;
  const description = page.movie.description.trim() || seasonSeoDescription(page);

  return <div className="container py-6">
    <JsonLd data={[
      movieJsonLd(page.movie),
      videoObjectJsonLd(page.movie),
      breadcrumbJsonLd([
        { name: "REDFILM", url: "/" },
        { name: "Сериалы", url: "/series" },
        { name: page.movie.titleRu, url: watchPath(page.movie) },
        { name: `${page.season} сезон`, url: seasonPath(page.movie, page.season) },
      ]),
      itemListJsonLd(`Похожие сериалы к ${page.movie.titleRu}`, seasonPath(page.movie, page.season), similar),
    ]} />

    <nav className="mb-5 text-sm text-[#85858f]"><Link href="/">REDFILM</Link> / <Link href="/series">Сериалы</Link> / <Link href={watchPath(page.movie)}>{page.movie.titleRu}</Link> / {page.season} сезон</nav>

    <section className="glass-panel section-glow mb-6 rounded-[26px] p-5 sm:p-7">
      <span className="mf-badge">SEO сезон</span>
      <h1 className="mt-3 text-[clamp(1.7rem,5vw,3.2rem)] font-black tracking-[-.035em] text-white">{h1}</h1>
      <p className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={watchPath(page.movie)} className="mf-btn mf-btn-primary">Открыть основной сериал</Link>
        {page.movie.genres.slice(0, 4).map((item) => <Link key={item.genreId} href={genrePath(item.genre)} className="mf-btn">{item.genre.name}</Link>)}
      </div>
    </section>

    <PlayerBlock movie={page.movie} />

    {seasons.length > 1 ? <section className="mf-panel mt-7 p-5 sm:p-6">
      <h2 className="text-xl font-black text-white">Другие сезоны сериала {page.movie.titleRu}</h2>
      <div className="mt-4 flex flex-wrap gap-2">{seasons.map((season) => <Link key={season} href={seasonPath(page.movie, season)} className={season === page.season ? "mf-btn mf-btn-primary" : "mf-btn"}>{season} сезон</Link>)}</div>
    </section> : null}

    {similar.length ? <section className="mt-7">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-white">Похожие сериалы</h2><Link href={similarPath(page.movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link></div>
      <div className="movie-grid">{similar.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
    </section> : null}

    <section className="mf-panel mt-7 p-5 sm:p-6">
      <h2 className="text-xl font-black text-white">Почему эта страница нужна</h2>
      <p className="mt-3 max-w-4xl leading-relaxed text-[#a1a1aa]">Многие зрители ищут не весь сериал, а конкретный сезон: «{page.movie.titleRu} {page.season} сезон смотреть онлайн», «{page.movie.titleRu} {page.season} сезон все серии» или «{page.movie.titleRu} продолжение». REDFILM связывает сезонную страницу с основным сериалом, жанрами и похожими рекомендациями, чтобы быстро перейти к просмотру.</p>
    </section>
  </div>;
}
