import Link from "next/link";
import type { Movie } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { MovieCard } from "./movie-card";

type Props = {
  title: string;
  href: string;
  movies: Pick<Movie, "slug" | "titleRu" | "year" | "posterUrl" | "quality" | "kpRating" | "imdbRating">[];
};

export function SectionGrid({ title, href, movies }: Props) {
  return (
    <section className="mt-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-[#f0d79f]/85 mb-2">Премиальная подборка</div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">{title}</h2>
            <Link href={href} className="inline-flex items-center gap-1 text-[#f0d79f] hover:text-[#ffe5b7] transition-colors">
              Смотреть всё <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="vip-soft-panel px-4 py-2 text-white/85">Последние</span>
          <span className="vip-soft-panel px-4 py-2 text-white/55">Популярные</span>
          <span className="vip-soft-panel px-4 py-2 text-white/55">По рейтингу</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </section>
  );
}
