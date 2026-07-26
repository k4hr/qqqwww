import type { Metadata } from "next";
import Link from "next/link";
import { ContentType, type Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/lib/list-page";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere, extractCountries } from "@/lib/catalog-filters";
import { CATALOG_GENRES, genreWhere, getGenreTaxonomy } from "@/lib/catalog-taxonomy";
import { countryPath, watchPath } from "@/lib/seo-links";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; country?: string; type?: string; year?: string; page?: string }> };

async function resolveGenre(slug: string) {
  const taxonomy = getGenreTaxonomy(slug);
  const exact = await prisma.genre.findUnique({ where: { slug } });
  if (!taxonomy && !exact) return null;

  return {
    label: taxonomy?.label ?? exact!.name,
    canonicalSlug: taxonomy?.slug ?? exact!.slug,
    where: genreWhere(slug),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const genre = await resolveGenre(slug);
  if (!genre) return {};

  const title = `${genre.label} смотреть онлайн — REDFILM`;
  const description = `Фильмы и сериалы жанра ${genre.label}: популярные картины, новинки, рейтинги и просмотр онлайн.`;
  const canonical = `/genre/${genre.canonicalSlug}`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort, country, type, year, page } = await searchParams;
  const resolved = await resolveGenre(slug);
  if (!resolved) notFound();

  const movieWhere: Prisma.MovieWhereInput = {
    AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), resolved.where],
  };

  const [candidates, count] = await Promise.all([
    prisma.movie.findMany({
      where: movieWhere,
      orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.movie.count({ where: movieWhere }),
  ]);

  if (count < 5) notFound();

  const contentType = type === "SERIES" ? ContentType.SERIES
    : type === "CARTOON" ? ContentType.CARTOON
      : type === "ANIME" ? ContentType.ANIME
        : type === "MOVIE" ? ContentType.MOVIE
          : undefined;
  const popularYears = [...new Set(candidates.map((movie) => movie.year))].slice(0, 8);
  const popularCountries = [...new Set(candidates.flatMap((movie) => extractCountries(movie.country)))].slice(0, 6);
  const relatedGenres = CATALOG_GENRES.filter((item) => item.slug !== resolved.canonicalSlug).slice(0, 12);

  return <>
    <ListPage
      title={`${resolved.label} смотреть онлайн`}
      description={[
        `В разделе собраны фильмы и сериалы жанра ${resolved.label.toLowerCase()}, доступные для просмотра на REDFILM.`,
        `Используйте фильтры по году, стране и типу, чтобы быстрее найти подходящую картину среди ${count} доступных карточек.`,
      ]}
      genreSlug={slug}
      yearFilter={year}
      sort={sort}
      country={country}
      type={contentType}
      showCountryFilter
      showTypeFilter
      showYearFilter
      page={Number(page) || 1}
    />
    <section className="container mb-8">
      <div className="border-t border-white/[.055] pt-7">
        <h2 className="rf-section-title">Навигация по жанру</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {popularYears.map((item) => <Link key={item} href={`/genre/${resolved.canonicalSlug}?year=${item}`} className="mf-btn">{item} год</Link>)}
          {popularCountries.map((item) => <Link key={item} href={countryPath(item)} className="mf-btn">{item}</Link>)}
        </div>
        <h3 className="mt-6 text-sm font-semibold text-white">Топ жанра</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.slice(0, 6).map((movie) => <Link key={movie.id} href={watchPath(movie)} className="mf-pill min-h-11">{movie.titleRu}</Link>)}
        </div>
        <h3 className="mt-6 text-sm font-semibold text-white">Похожие жанры</h3>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {relatedGenres.map((item) => <Link key={item.slug} href={`/genre/${item.slug}`} className="mf-pill min-h-11 shrink-0">{item.label}</Link>)}
        </nav>
      </div>
    </section>
  </>;
}
