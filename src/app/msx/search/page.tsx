import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { TvFocusProvider } from "@/components/tv/tv-focus-provider";
import { TvCss, TvPosterGrid, TvShell, TvTopBar } from "@/components/tv/tv-ui";
import { searchTvMovies, TV_REVALIDATE_SECONDS } from "@/lib/tv";
import { normalizeSearchQuery } from "@/lib/search";

export const revalidate = TV_REVALIDATE_SECONDS;

export const metadata: Metadata = {
  title: "Поиск — REDFILM TV",
  description: "Поиск фильмов и сериалов REDFILM TV для Media Station X и Smart TV.",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function MsxSearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q ?? "").slice(0, 120);
  const movies = query ? await searchTvMovies(query, 48) : [];

  return (
    <TvShell>
      <TvCss />
      <TvFocusProvider />
      <TvTopBar />
      <section className="px-10 py-10">
        <Link data-tv-focus data-tv-autofocus href="/msx" className="tv-pill mb-8 inline-flex"><ArrowLeft size={22} /> Назад</Link>
        <h1 className="text-[clamp(3rem,7vw,6.5rem)] font-black leading-none tracking-[-.06em]">Поиск REDFILM TV</h1>
        <form action="/msx/search" className="mt-8 grid grid-cols-[minmax(0,1fr)_auto] gap-4 max-md:grid-cols-1">
          <input data-tv-focus className="tv-input" name="q" defaultValue={query} placeholder="Введите название фильма или сериала" />
          <button data-tv-focus className="tv-cta" type="submit"><Search size={28} /> Найти</button>
        </form>
        {query ? <p className="mt-6 text-2xl font-bold text-white/60">Найдено: {movies.length}</p> : <p className="mt-6 text-2xl text-white/60">Введите запрос с пульта, клавиатуры или через мобильную клавиатуру телевизора.</p>}
      </section>
      {movies.length ? <TvPosterGrid movies={movies} /> : query ? <div className="mx-10 rounded-[30px] border border-white/10 bg-white/[.06] p-10 text-3xl font-black text-white/70">Ничего не найдено. Попробуй другое название.</div> : null}
    </TvShell>
  );
}
