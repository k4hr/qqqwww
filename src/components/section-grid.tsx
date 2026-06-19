import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Movie } from "@prisma/client";
import { MovieCard } from "./movie-card";

type Props = {
  title: string;
  href: string;
  movies: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">[];
};

export function SectionGrid({ title, href, movies }: Props) {
  return (
    <section className="mf-panel mt-8 overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#e50914]/10 blur-3xl" />
      <div className="relative mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Link href={href} className="mf-section-title group inline-flex items-center gap-3 self-start">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e50914]/35 bg-[#e50914]/12 text-[#e50914] shadow-[0_0_24px_rgba(229,9,20,.18)]">
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <span>{title}</span>
        </Link>
        <div className="flex gap-2 overflow-x-auto rounded-full border border-white/[.07] bg-black/20 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={`${href}?sort=latest`} className="mf-pill">Последние</Link>
          <Link href={`${href}?sort=popular`} className="mf-pill">Популярные</Link>
          <Link href={`${href}?sort=rating`} className="mf-pill">По рейтингу</Link>
        </div>
      </div>

      {movies.length ? (
        <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 lg:gap-4">
          {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
        </div>
      ) : (
        <div className="poster-fallback relative rounded-2xl border border-white/10 px-5 py-12 text-center text-sm text-[#a1a1aa]">
          Каталог обновляется. Фильмы скоро появятся.
        </div>
      )}
    </section>
  );
}
