import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const movies = query
    ? await prisma.movie.findMany({
        where: { AND: [vibixPublicMovieWhere, { OR: [
          { titleRu: { contains: query, mode: "insensitive" } },
          { titleOriginal: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ] }] },
        take: 60
      })
    : [];

  return (
    <div className="container py-6">
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="break-words text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">Поиск: {query || "введите запрос"}</h1>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" action="/search">
          <input name="q" defaultValue={query} className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-[#666670] focus:border-[#e50914]" placeholder="Название фильма или сериала" />
          <button className="mf-btn mf-btn-primary max-sm:w-full">Найти</button>
        </form>
      </section>
      <div className="movie-grid">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
      {query && !movies.length ? <div className="glass-panel rounded-3xl p-8 text-center text-[#a1a1aa]">Каталог обновляется. Фильмы скоро появятся.</div> : null}
    </div>
  );
}
