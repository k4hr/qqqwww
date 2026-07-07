import { ContentType } from "@prisma/client";
import { redirect } from "next/navigation";
import { AnalyticsEvent } from "@/components/analytics-event";
import { CountryFilter } from "@/components/country-filter";
import { MovieCard } from "@/components/movie-card";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { buildHomeCatalogWhere } from "@/lib/catalog-safety";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { prisma } from "@/lib/prisma";
import { normalizeSearchQuery, searchMovies } from "@/lib/search";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";

export const revalidate = 600;

export const metadata = { title: "Поиск фильмов и сериалов — REDFILM", description: "Умный поиск доступных фильмов и сериалов по всей базе REDFILM.", alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string; country?: string; type?: string; year?: string; genre?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q ?? "").slice(0, 160);
  const routeIntent = resolveSearchRedirectPath(query);
  if (routeIntent) redirect(routeIntent.href);
  const selectedCountry = normalizeCatalogCountry(params.country ?? (query ? "all" : "main"));
  const filters = { country: selectedCountry, type: params.type, year: params.year, genre: params.genre };
  const [genres, searchedMovies] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 80 }),
    query ? searchMovies(query, filters, 48) : Promise.resolve([]),
  ]);
  const defaultMovies = query ? [] : await prisma.movie.findMany({
    where: { AND: [
      vibixPublicMovieWhere,
      buildCountryFilterWhere(selectedCountry),
      ...(Object.values(ContentType).includes(params.type as ContentType) ? [{ type: params.type as ContentType }] : []),
      ...(/^(19|20)\d{2}$/.test(params.year ?? "") ? [{ year: Number(params.year) }] : []),
      ...(params.genre ? [{ genres: { some: { genre: { slug: params.genre } } } }] : []),
    ] },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
    take: 48,
  });
  const popularFallback = query && !searchedMovies.length ? await prisma.movie.findMany({
    where: buildHomeCatalogWhere(),
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
    take: 12,
  }) : [];
  const movies = query ? searchedMovies : defaultMovies;
  const currentYear = new Date().getFullYear();

  return (
    <div className="container py-6">
      {query ? <AnalyticsEvent type="search" query={query} results={movies.length} /> : null}
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="break-words text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">Поиск: {query || "введите запрос"}</h1>
        <form className="mt-5 grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_130px_180px_auto]" action="/search">
          <input type="hidden" name="country" value={selectedCountry} />
          <input name="q" defaultValue={query} className="h-12 min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 text-[16px] text-white outline-none placeholder:text-[#666670] focus:border-[#e50914]" placeholder="Название, оригинальное название или ID" />
          <select name="type" defaultValue={params.type ?? ""} className="h-12 min-w-0 rounded-2xl border border-white/10 bg-[#111118] px-3 text-[16px] text-white"><option value="">Все типы</option><option value={ContentType.MOVIE}>Фильмы</option><option value={ContentType.SERIES}>Сериалы</option><option value={ContentType.CARTOON}>Мультфильмы</option><option value={ContentType.ANIME}>Аниме</option></select>
          <select name="year" defaultValue={params.year ?? ""} className="h-12 min-w-0 rounded-2xl border border-white/10 bg-[#111118] px-3 text-[16px] text-white"><option value="">Все годы</option>{Array.from({ length: 20 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}</option>)}</select>
          <select name="genre" defaultValue={params.genre ?? ""} className="h-12 min-w-0 rounded-2xl border border-white/10 bg-[#111118] px-3 text-[16px] text-white"><option value="">Все жанры</option>{genres.map((genre) => <option key={genre.id} value={genre.slug}>{genre.name}</option>)}</select>
          <button className="mf-btn mf-btn-primary max-md:w-full">Найти</button>
        </form>
        <CountryFilter country={selectedCountry} preserve={{ q: query || undefined, type: params.type, year: params.year, genre: params.genre }} />
      </section>

      {movies.length ? <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div> : null}
      {query && !movies.length ? <>
        <div className="glass-panel rounded-3xl p-7 text-center"><h2 className="text-xl font-black text-white">Ничего не найдено</h2><p className="mt-2 text-[#a1a1aa]">Проверьте написание, сократите запрос или попробуйте оригинальное название.</p></div>
        {popularFallback.length ? <section className="mt-8"><h2 className="mb-5 text-2xl font-black text-white">Популярные фильмы</h2><div className="movie-grid">{popularFallback.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></section> : null}
      </> : null}
    </div>
  );
}
