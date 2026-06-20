import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import type { ContentType } from "@prisma/client";
import { parseSort } from "@/lib/content";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { CountryFilter } from "@/components/country-filter";
import { timedMovieQuery } from "@/lib/query-performance";

type Props = {
  title: string;
  type?: ContentType;
  year?: number;
  genreSlug?: string;
  sort?: string;
  description?: string;
  country?: string;
  showCountryFilter?: boolean;
};

function filterHref(sort: string, country?: string, year?: number) {
  const params = new URLSearchParams();
  params.set("sort", sort);
  if (country) params.set("country", country);
  if (year) params.set("year", String(year));
  return `?${params.toString()}`;
}

export async function ListPage({ title, type, year, genreSlug, sort, description, country, showCountryFilter = false }: Props) {
  const selectedCountry = normalizeCatalogCountry(country);
  const movies = await timedMovieQuery(`catalog ${type ?? "all"}`, () => prisma.movie.findMany({
    where: {
      AND: [
        vibixPublicMovieWhere,
        buildCountryFilterWhere(selectedCountry),
        {
          ...(type ? { type } : {}),
          ...(year ? { year } : {}),
          ...(genreSlug ? { genres: { some: { genre: { slug: genreSlug } } } } : {}),
        },
      ],
    },
    orderBy: parseSort(sort),
    take: 48,
  }));

  return (
    <div className="container py-6">
      <div className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-4xl leading-relaxed text-[#a9a9b2]">{description}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterLink href={filterHref("latest", selectedCountry, year)} label="Последние" active={!sort || sort === "latest"} />
          <FilterLink href={filterHref("popular", selectedCountry, year)} label="Популярные" active={sort === "popular"} />
          <FilterLink href={filterHref("rating", selectedCountry, year)} label="По рейтингу" active={sort === "rating"} />
          <FilterLink href={filterHref("year", selectedCountry, year)} label="По году" active={sort === "year"} />
        </div>
        {showCountryFilter ? <CountryFilter country={selectedCountry} preserve={{ sort, year: year ? String(year) : undefined }} /> : null}
      </div>

      {movies.length ? (
        <div className="movie-grid">
          {movies.map((movie) => (
            <MovieCard key={movie.slug} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-[#a1a1aa]">
          Каталог обновляется. Фильмы скоро появятся.
        </div>
      )}
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={active ? "mf-btn mf-btn-primary" : "mf-btn"}
    >
      {label}
    </Link>
  );
}
