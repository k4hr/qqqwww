import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Film, Play } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { filmIntro } from "@/lib/seo-text";
import { findFranchiseParts, findSimilarSeoMovies, getSeoMovieByFilmSlug, matchingSeoTopics } from "@/lib/seo-pages";
import { countryPath, filmPath, franchisePath, genrePath, likePath, personPath, similarPath, siteUrl, watchPath, yearPath } from "@/lib/seo-links";
import { extractCountries } from "@/lib/catalog-filters";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getSeoMovieByFilmSlug((await params).slug);
  if (!movie) return {};
  const title = `${movie.titleRu} (${movie.year}) смотреть онлайн бесплатно — REDFILM`;
  const description = `Смотреть ${movie.titleRu} (${movie.year}) онлайн: описание, рейтинги КП и IMDb, качество ${movie.quality} и похожие фильмы на REDFILM.`;
  const canonical = filmPath(movie);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "video.movie", images: movie.backdropUrl || movie.posterUrl ? [{ url: movie.backdropUrl || movie.posterUrl! }] : undefined },
  };
}

export default async function FilmPage({ params }: Props) {
  const movie = await getSeoMovieByFilmSlug((await params).slug);
  if (!movie) notFound();
  const [similar, parts] = await Promise.all([findSimilarSeoMovies(movie, 6), findFranchiseParts(movie)]);
  const countries = extractCountries(movie.country);
  const topics = matchingSeoTopics(movie);
  const intros = filmIntro(movie);
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;

  return (
    <div className="container py-5 sm:py-7">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Movie", name: movie.titleRu,
        alternateName: movie.titleOriginal || undefined, datePublished: String(movie.year),
        image: movie.posterUrl || movie.backdropUrl || undefined, description: movie.description,
        genre: movie.genres.map((item) => item.genre.name), countryOfOrigin: countries.map((name) => ({ "@type": "Country", name })),
        aggregateRating: rating ? { "@type": "AggregateRating", ratingValue: rating, bestRating: 10, worstRating: 0 } : undefined,
        potentialAction: { "@type": "WatchAction", target: siteUrl(watchPath(movie)) },
        url: siteUrl(filmPath(movie)),
      }} />
      <nav className="mb-5 flex flex-wrap gap-2 text-sm text-[#85858f]" aria-label="Хлебные крошки">
        <Link href="/">REDFILM</Link><span>/</span><Link href={movie.type === "SERIES" ? "/series" : "/movies"}>{movie.type === "SERIES" ? "Сериалы" : "Фильмы"}</Link><span>/</span><span>{movie.titleRu}</span>
      </nav>

      <article className="cinema-glow mf-panel overflow-hidden p-4 sm:p-6 lg:p-8">
        {movie.backdropUrl ? <div className="absolute inset-x-0 top-0 h-[420px] bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${movie.backdropUrl})` }} /> : null}
        <div className="relative grid gap-6 md:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
          <div className="poster-fallback relative mx-auto aspect-[2/3] w-full max-w-[230px] overflow-hidden rounded-[24px] border border-white/10">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="230px" unoptimized priority /> : <div className="absolute inset-0 flex items-center justify-center text-[#71717a]"><Film size={52} /></div>}
          </div>
          <div className="min-w-0">
            <span className="mf-badge">{movie.quality || "HD"}</span>
            <h1 className="mt-4 break-words text-[clamp(1.9rem,6vw,3.5rem)] font-black leading-tight text-white">{movie.titleRu} ({movie.year}) смотреть онлайн</h1>
            {intros.map((text) => <p key={text} className="mt-4 max-w-4xl leading-relaxed text-[#b7b7c0]">{text}</p>)}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={watchPath(movie)} className="mf-btn mf-btn-primary gap-2"><Play size={16} fill="currentColor" /> Смотреть онлайн</Link>
              <Link href={similarPath(movie)} className="mf-btn">Похожие фильмы</Link>
              <Link href={likePath(movie)} className="mf-btn">Что посмотреть после</Link>
              {parts.length >= 2 ? <Link href={franchisePath(movie)} className="mf-btn">Все части</Link> : null}
              {topics.map((topic) => <Link key={topic[0]} href={`/collections/${topic[0]}`} className="mf-btn">{topic[1]}</Link>)}
            </div>
            <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Страна" value={countries.length ? countries.map((country, index) => <span key={country}>{index ? ", " : ""}<Link href={countryPath(country)}>{country}</Link></span>) : "—"} />
              <Fact label="Год" value={<Link href={yearPath(movie)}>{movie.year}</Link>} />
              <Fact label="Жанры" value={movie.genres.length ? movie.genres.map((item, index) => <span key={item.genreId}>{index ? ", " : ""}<Link href={genrePath(item.genre)}>{item.genre.name}</Link></span>) : "—"} />
              <Fact label="КП" value={movie.kpRating?.toFixed(1) ?? "—"} />
              <Fact label="IMDb" value={movie.imdbRating?.toFixed(1) ?? "—"} />
              <Fact label="Длительность" value={movie.duration ? `${movie.duration} мин.` : "—"} />
            </dl>
          </div>
        </div>
      </article>

      <section className="mf-panel mt-6 p-5 sm:p-6">
        <h2 className="text-2xl font-black text-white">О фильме</h2>
        <p className="mt-4 max-w-5xl leading-relaxed text-[#b7b7c0]">{movie.description}</p>
        {movie.cast.length ? <p className="mt-4 text-sm text-[#a1a1aa]"><b className="text-white">В ролях:</b> {movie.cast.slice(0, 8).map((item, index) => <span key={item.personId}>{index ? ", " : ""}<Link href={personPath(item.person.nameRu)} className="hover:text-[#ff4d55]">{item.person.nameRu}</Link></span>)}</p> : null}
      </section>

      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-white">Похожие фильмы</h2><Link href={similarPath(movie)} className="text-sm font-bold text-[#ff4d55]">Все похожие</Link></div>
        <div className="movie-grid">{similar.map((item) => <MovieCard key={item.id} movie={item} />)}</div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><dt className="text-xs uppercase tracking-wider text-[#71717a]">{label}</dt><dd className="mt-1 text-sm text-white">{value}</dd></div>;
}
