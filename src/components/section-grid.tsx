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
    <section className="mf-panel mt-7 p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href={href} className="mf-section-title group inline-flex items-center gap-3 self-start">
          <span className="h-7 w-1 rounded-full bg-[#e50914]" />
          {title}
          <ArrowRight size={20} className="text-[#e50914] transition-transform group-hover:translate-x-1" />
        </Link>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={`${href}?sort=latest`} className="mf-pill">Последние</Link>
          <Link href={`${href}?sort=popular`} className="mf-pill">Популярные</Link>
          <Link href={`${href}?sort=rating`} className="mf-pill">По рейтингу</Link>
        </div>
      </div>

      {movies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 lg:gap-4">
          {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
        </div>
      ) : (
        <div className="poster-fallback rounded-xl border border-[#27272f] px-5 py-12 text-center text-sm text-[#a1a1aa]">
          В этом разделе пока нет опубликованных карточек.
        </div>
      )}
    </section>
  );
}
