import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { MovieCard } from "@/components/movie-card";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { CountryFilter } from "@/components/country-filter";
import { timedMovieQuery } from "@/lib/query-performance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Поиск фильмов и сериалов — REDFILM", description: "Поиск доступных фильмов и сериалов по всей базе REDFILM.", alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string; country?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", country } = await searchParams;
  const query = q.trim();
  const selectedCountry = normalizeCatalogCountry(country ?? (query ? "all" : "main"));
  const searchWhere: Prisma.MovieWhereInput = query ? { OR: [
    { titleRu: { contains: query, mode: "insensitive" } },
    { titleOriginal: { contains: query, mode: "insensitive" } },
  ] } : {};
  const movies = await timedMovieQuery("search movies", () => prisma.movie.findMany({
        where: { AND: [
          vibixPublicMovieWhere,
          buildCountryFilterWhere(selectedCountry),
          searchWhere,
        ] },
        orderBy: [{ createdAt: "desc" }],
        take: 30,
      }));

  return (
    <div className="container py-6">
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="break-words text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">Поиск: {query || "введите запрос"}</h1>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" action="/search">
          <input type="hidden" name="country" value={selectedCountry} />
          <input name="q" defaultValue={query} className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-[#666670] focus:border-[#e50914]" placeholder="Название фильма или сериала" />
          <button className="mf-btn mf-btn-primary max-sm:w-full">Найти</button>
        </form>
        <CountryFilter country={selectedCountry} preserve={{ q: query || undefined }} />
      </section>
      <div className="movie-grid">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
      {!movies.length ? <div className="glass-panel rounded-3xl p-8 text-center text-[#a1a1aa]">По вашему запросу ничего не найдено.</div> : null}
    </div>
  );
}
