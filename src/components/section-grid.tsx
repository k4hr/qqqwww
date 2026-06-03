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
    <section className="mt-8">
      <div className="flex items-center gap-4 mb-4">
        <Link href={href} className="bg-mario-green text-white font-bold text-xl px-5 py-3 rounded-sm hover:brightness-95">
          {title} ›
        </Link>
        <div className="hidden sm:flex gap-3 text-sm">
          <span className="bg-white border border-mario-line px-8 py-3">Последние</span>
          <span className="bg-white border border-mario-line px-8 py-3 text-neutral-500">Популярные</span>
          <span className="bg-white border border-mario-line px-8 py-3 text-neutral-500">По рейтингу</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </section>
  );
}
