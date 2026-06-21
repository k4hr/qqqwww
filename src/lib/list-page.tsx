import Link from "next/link";
import { MovieCard } from "@/components/movie-card";
import type { ContentType } from "@prisma/client";
import { CountryFilter } from "@/components/country-filter";
import { JsonLd } from "@/components/json-ld";
import { siteUrl, watchPath } from "@/lib/seo-links";
import { CATALOG_GENRES, genreLabel } from "@/lib/catalog-taxonomy";
import { getCatalogMovies } from "@/lib/catalog-query";

type Props = {
  title: string;
  type?: ContentType;
  year?: number;
  yearFilter?: string;
  genreSlug?: string;
  filterGenreSlug?: string;
  sort?: string;
  description?: string | string[];
  country?: string;
  showCountryFilter?: boolean;
  showTypeFilter?: boolean;
  showYearFilter?: boolean;
  showGenreFilter?: boolean;
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

export async function ListPage({ title, type, year, yearFilter, genreSlug, filterGenreSlug, sort, description, country, showCountryFilter = false, showTypeFilter = false, showYearFilter = false, showGenreFilter = false, page = 1 }: Props) {
  const safePage = Math.max(1, Math.min(page, 100));
  const typeParam = showTypeFilter ? type : undefined;
  const yearParam = yearFilter ?? year;
  const selectedGenre = genreSlug ?? filterGenreSlug;
  const movies = await getCatalogMovies({ type, year, yearFilter, genreSlug: selectedGenre, countrySlug: country, sort, page: safePage, pageSize: 48 });
  const genreOptions = CATALOG_GENRES.slice(0, 14);

  return (
    <div className="container py-6">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: (safePage - 1) * 48 + index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) } }} />
      <div className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[-.035em] text-white">{title}</h1>
        {description ? (Array.isArray(description) ? description : [description]).map((text) => <p key={text} className="mt-3 max-w-4xl leading-relaxed text-[#a9a9b2]">{text}</p>) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterLink href={filterHref({ sort: "fresh", country, year: yearParam, type: typeParam, genre: selectedGenre })} label="Новинки" active={!sort || sort === "new" || sort === "latest" || sort === "fresh"} />
          <FilterLink href={filterHref({ sort: "popular", country, year: yearParam, type: typeParam, genre: selectedGenre })} label="Популярные" active={sort === "popular"} />
          <FilterLink href={filterHref({ sort: "top", country, year: yearParam, type: typeParam, genre: selectedGenre })} label="ТОП" active={sort === "top" || sort === "rating"} />
          <FilterLink href={filterHref({ sort: "year", country, year: yearParam, type: typeParam, genre: selectedGenre })} label="По году" active={sort === "year"} />
        </div>
        {showTypeFilter ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><FilterLink href={filterHref({ sort, country, year: yearParam, genre: selectedGenre })} label="Все типы" active={!type} /><FilterLink href={filterHref({ sort, country, year: yearParam, type: "MOVIE", genre: selectedGenre })} label="Фильмы" active={type === "MOVIE"} /><FilterLink href={filterHref({ sort, country, year: yearParam, type: "SERIES", genre: selectedGenre })} label="Сериалы" active={type === "SERIES"} /></div> : null}
        {showYearFilter ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><FilterLink href={filterHref({ sort, country, type: typeParam, genre: selectedGenre })} label="Все годы" active={!yearFilter} />{Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - index).map((item) => <FilterLink key={item} href={filterHref({ sort, country, year: item, type: typeParam, genre: selectedGenre })} label={String(item)} active={yearFilter === String(item)} />)}</div> : null}
        {showGenreFilter ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><FilterLink href={filterHref({ sort, country, year: yearParam, type: typeParam })} label="Все жанры" active={!filterGenreSlug} />{genreOptions.map((item) => <FilterLink key={item.slug} href={filterHref({ sort, country, year: yearParam, type: typeParam, genre: item.slug })} label={item.label} active={genreLabel(filterGenreSlug) === item.label} />)}</div> : null}
        {showCountryFilter ? <CountryFilter country={country} preserve={{ sort, year: yearParam ? String(yearParam) : undefined, type: typeParam, genre: selectedGenre }} /> : null}
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
      {(safePage > 1 || movies.length === 48) ? <nav className="mt-7 flex items-center justify-center gap-3" aria-label="Пагинация">{safePage > 1 ? <Link href={filterHref({ sort, country, year: yearParam, type: typeParam, genre: selectedGenre, page: safePage - 1 })} className="mf-btn">Назад</Link> : null}<span className="mf-pill min-h-11">Страница {safePage}</span>{movies.length === 48 ? <Link href={filterHref({ sort, country, year: yearParam, type: typeParam, genre: selectedGenre, page: safePage + 1 })} className="mf-btn">Далее</Link> : null}</nav> : null}
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
