import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const movies = query
    ? await prisma.movie.findMany({
        where: { isPublished: true, OR: [
          { titleRu: { contains: query, mode: "insensitive" } },
          { titleOriginal: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ] },
        take: 60
      })
    : [];

  return (
    <div className="container py-5">
      <h1 className="text-3xl font-medium mb-5">Поиск: {query || "введите запрос"}</h1>
      <form className="mb-6 flex gap-2" action="/search">
        <input name="q" defaultValue={query} className="bg-white border border-mario-line h-11 px-4 flex-1" placeholder="Название фильма или сериала" />
        <button className="bg-mario-green text-white font-bold px-6">Найти</button>
      </form>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </div>
  );
}
