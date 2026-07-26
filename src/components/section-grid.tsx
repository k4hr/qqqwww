import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Movie } from "@prisma/client";
import { MovieCard } from "./movie-card";

type Props = {
  title: string;
  href: string;
  movies: Pick<Movie, "id" | "slug" | "titleRu" | "year" | "type" | "posterUrl" | "quality" | "kpRating" | "imdbRating">[];
  showSorts?: boolean;
  mobileCarousel?: boolean;
};

export function SectionGrid({ title, href, movies, showSorts = true, mobileCarousel = false }: Props) {
  if (!movies.length) return null;
  return (
    <section className="rf-section">
      <div className="rf-section-header">
        <Link href={href} className="rf-section-title inline-flex min-h-11 items-center">
          {title}
        </Link>
        {showSorts ? <div className="rf-filter-row">
          <Link href={`${href}?sort=latest`} className="rf-filter">Последние</Link>
          <Link href={`${href}?sort=popular`} className="rf-filter">Популярные</Link>
          <Link href={`${href}?sort=rating`} className="rf-filter">По рейтингу</Link>
        </div> : <Link href={href} className="rf-section-link">Смотреть все <ArrowRight size={15} /></Link>}
      </div>

      <div className={`movie-grid ${mobileCarousel ? "home-movie-strip" : ""}`}>
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
    </section>
  );
}
