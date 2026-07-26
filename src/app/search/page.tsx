import { ContentType } from "@prisma/client";
import Link from "next/link";
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
import { parseSearchIntent } from "@/lib/search-v2";
import { seasonPath, watchPath } from "@/lib/seo-links";

export const revalidate = 600;

export const metadata = { title: "Поиск фильмов и сериалов — REDFILM", description: "Умный поиск доступных фильмов и сериалов по всей базе REDFILM.", alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string; country?: string; type?: string; year?: string; genre?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q ?? "").slice(0, 160);
  const parsedQuery = parseSearchIntent(query);
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
      <section className="rf-catalog-intro mb-7">
        <h1 className="rf-page-title break-words">Поиск: {query || "введите запрос"}</h1>
        <form className="mt-5" action="/search">
          <input type="hidden" name="country" value={selectedCountry} />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input name="q" defaultValue={query} className="min-h-12 min-w-0 rounded-xl border border-white/[.08] bg-white/[.035] px-4 text-[16px] text-white outline-none placeholder:text-[#666670] focus:border-[#e31b32]/60" placeholder="Название, оригинальное название или ID" />
            <button className="mf-btn mf-btn-primary min-w-[112px] max-sm:w-full">Найти</button>
          </div>
          <details className="rf-responsive-filters mt-3">
            <summary className="mf-btn w-full cursor-pointer list-none md:hidden">Фильтры</summary>
            <div className="mt-3 grid gap-2 border-t border-white/[.055] pt-4 md:mt-0 md:grid-cols-3 md:border-0 md:pt-0">
              <select name="type" defaultValue={params.type ?? ""} className="mf-input min-h-12 min-w-0 w-full"><option value="">Все типы</option><option value={ContentType.MOVIE}>Фильмы</option><option value={ContentType.SERIES}>Сериалы</option><option value={ContentType.CARTOON}>Мультфильмы</option><option value={ContentType.ANIME}>Аниме</option></select>
              <select name="year" defaultValue={params.year ?? ""} className="mf-input min-h-12 min-w-0 w-full"><option value="">Все годы</option>{Array.from({ length: 20 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}</option>)}</select>
              <select name="genre" defaultValue={params.genre ?? ""} className="mf-input min-h-12 min-w-0 w-full"><option value="">Все жанры</option>{genres.map((genre) => <option key={genre.id} value={genre.slug}>{genre.name}</option>)}</select>
            </div>
          </details>
        </form>
        <CountryFilter country={selectedCountry} preserve={{ q: query || undefined, type: params.type, year: params.year, genre: params.genre }} />
      </section>

      {parsedQuery.season && movies[0]?.type === ContentType.SERIES ? (
        <section className="mb-7 border-l-2 border-[#e31b32] py-2 pl-4 text-white">
          <div className="rf-section-eyebrow">Сезонный запрос</div>
          <h2 className="mt-2 text-xl font-semibold">{movies[0].titleRu}: {parsedQuery.season.season} сезон{parsedQuery.season.episode ? `, ${parsedQuery.season.episode} серия` : ""}</h2>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            {(movies[0].vibixSeasonCount ?? 0) >= parsedQuery.season.season
              ? "Сезон подтверждён в каталоге, ссылка ведёт сразу на страницу сезона."
              : "Сезон пока не подтверждён в каталоге, основная ссылка ведёт на страницу сериала."}
          </p>
          <Link className="mf-btn mf-btn-primary mt-4" href={(movies[0].vibixSeasonCount ?? 0) >= parsedQuery.season.season ? seasonPath(movies[0], parsedQuery.season.season) : watchPath(movies[0])}>
            Открыть
          </Link>
        </section>
      ) : null}

      {movies.length ? <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div> : null}
      {query && !movies.length ? <>
        <div className="border-y border-white/[.055] py-10 text-center"><h2 className="text-xl font-semibold text-white">Ничего не найдено</h2><p className="mt-2 text-[#a1a1aa]">Проверьте написание, сократите запрос или попробуйте оригинальное название.</p></div>
        {popularFallback.length ? <section className="rf-section"><h2 className="rf-section-title mb-5">Популярные фильмы</h2><div className="movie-grid">{popularFallback.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div></section> : null}
      </> : null}
    </div>
  );
}
