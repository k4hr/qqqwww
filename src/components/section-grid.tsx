import Link from "next/link";
import type { Movie } from "@prisma/client";
import { MovieCard } from "./movie-card";

type Props = {
  title: string;
  href: string;
  movies: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">[];
};

export function SectionGrid({ title, href, movies }: Props) {
  return (
    <section className="mt-7">
      <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-1">
        <Link href={href} className="mf-section-title whitespace-nowrap">{title} ›</Link>
        <Link href={`${href}?sort=latest`} className="bg-white border border-[#e4e4e4] px-8 py-3 text-sm text-[#333] rounded-sm whitespace-nowrap hover:border-[#e50914]">Последние</Link>
        <Link href={`${href}?sort=popular`} className="bg-white border border-[#e4e4e4] px-8 py-3 text-sm text-neutral-500 rounded-sm whitespace-nowrap hover:border-[#e50914]">Популярные</Link>
        <Link href={`${href}?sort=rating`} className="bg-white border border-[#e4e4e4] px-8 py-3 text-sm text-neutral-500 rounded-sm whitespace-nowrap hover:border-[#e50914]">По рейтингу</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </section>
  );
}
