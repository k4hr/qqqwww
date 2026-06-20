import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import type { ContentType } from "@prisma/client";
import { parseSort } from "@/lib/content";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildCountryFilterWhere, normalizeCatalogCountry } from "@/lib/catalog-filters";
import { CountryFilter } from "@/components/country-filter";
import { timedMovieQuery } from "@/lib/query-performance";
import { JsonLd } from "@/components/json-ld";
import { siteUrl, watchPath } from "@/lib/seo-links";

type Props = {
  title: string;
  type?: ContentType;
  year?: number;
  yearFilter?: string;
  genreSlug?: string;
  sort?: string;
  description?: string;
  country?: string;
  showCountryFilter?: boolean;
  showTypeFilter?: boolean;
  page?: number;
};

function filterHref({ sort, country, year, type, genre, page }: { sort?: string; country?: string; year?: string | number; type?: string; genre?: string; page?: number }) {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  if (country) params.set("country", country);
  if (year) params.set("year", String(year));
  if (type) params.set("type", type);
  if (genre) params.set("genre", genre);
  if (page && page > 1) params.set("page", String(page));
  return `?${params.toString()}`;
}

function yearWhere(year?: number, yearFilter?: string) {
  if (year) return { year };
  if (!yearFilter) return {};
  if (/^\d{4}$/.test(yearFilter)) return { year: Number(yearFilter) };
  const decade = yearFilter.match(/^(19|20)\d0s$/) ? Number(yearFilter.slice(0, 4)) : null;
  return decade ? { year: { gte: decade, lte: decade + 9 } } : {};
}

export async function ListPage({ title, type, year, yearFilter, genreSlug, sort, description, country, showCountryFilter = false, showTypeFilter = false, page = 1 }: Props) {
  const selectedCountry = normalizeCatalogCountry(country);
  const safePage = Math.max(1, Math.min(page, 100));
  const typeParam = showTypeFilter ? type : undefined;
  const yearParam = yearFilter ?? year;
  const movies = await timedMovieQuery(`catalog ${type ?? "all"}`, () => prisma.movie.findMany({
    where: {
      AND: [
        vibixPublicMovieWhere,
        buildCountryFilterWhere(selectedCountry),
        {
          ...(type ? { type } : {}),
          ...yearWhere(year, yearFilter),
          ...(genreSlug ? { genres: { some: { genre: { slug: genreSlug } } } } : {}),
        },
      ],
    },
    orderBy: parseSort(sort),
    skip: (safePage - 1) * 48,
    take: 48,
  }));

  return (
    <div className="container py-6">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: (safePage - 1) * 48 + index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) } }} />
      <div className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-4xl leading-relaxed text-[#a9a9b2]">{description}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterLink href={filterHref({ sort: "new", country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug })} label="Новинки" active={!sort || sort === "new" || sort === "latest"} />
          <FilterLink href={filterHref({ sort: "popular", country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug })} label="Популярные" active={sort === "popular"} />
          <FilterLink href={filterHref({ sort: "rating", country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug })} label="По рейтингу" active={sort === "rating"} />
          <FilterLink href={filterHref({ sort: "year", country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug })} label="По году" active={sort === "year"} />
        </div>
        {showTypeFilter ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><FilterLink href={filterHref({ sort, country: selectedCountry, year: yearParam, genre: genreSlug })} label="Все типы" active={!type} /><FilterLink href={filterHref({ sort, country: selectedCountry, year: yearParam, type: "MOVIE", genre: genreSlug })} label="Фильмы" active={type === "MOVIE"} /><FilterLink href={filterHref({ sort, country: selectedCountry, year: yearParam, type: "SERIES", genre: genreSlug })} label="Сериалы" active={type === "SERIES"} /></div> : null}
        {showCountryFilter ? <CountryFilter country={selectedCountry} preserve={{ sort, year: yearParam ? String(yearParam) : undefined, type: typeParam, genre: genreSlug }} /> : null}
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
      {(safePage > 1 || movies.length === 48) ? <nav className="mt-7 flex items-center justify-center gap-3" aria-label="Пагинация">{safePage > 1 ? <Link href={filterHref({ sort, country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug, page: safePage - 1 })} className="mf-btn">Назад</Link> : null}<span className="mf-pill min-h-11">Страница {safePage}</span>{movies.length === 48 ? <Link href={filterHref({ sort, country: selectedCountry, year: yearParam, type: typeParam, genre: genreSlug, page: safePage + 1 })} className="mf-btn">Далее</Link> : null}</nav> : null}
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
