import { TgMovieCard } from "@/components/tg/tg-movie-card";
import { TgSearchBox } from "@/components/tg/tg-search-box";
import { searchTgMovies } from "@/lib/telegram/movies";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function TgSearchPage({ searchParams }: Props) {
  const q = (await searchParams).q?.trim() || "";
  const movies = q ? await searchTgMovies(q, 24) : [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">Поиск</h1>
      <TgSearchBox defaultValue={q} />
      {q ? <p className="mt-4 text-sm text-[#a1a1aa]">Найдено: {movies.length}</p> : <p className="mt-4 text-sm text-[#a1a1aa]">Введите название фильма или сериала.</p>}
      <div className="mt-4 space-y-3">
        {movies.map((movie) => <TgMovieCard key={movie.id} movie={movie} />)}
      </div>
      {q && !movies.length ? <div className="mt-4 rounded-3xl border border-white/10 bg-white/[.04] p-5 text-[#a1a1aa]">Ничего не нашёл. Попробуйте другое название.</div> : null}
    </div>
  );
}
