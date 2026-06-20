import Link from "next/link";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { collectionLinksForYear } from "@/lib/collections";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { VibixBanner } from "@/components/vibix-banner";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { timedMovieQuery } from "@/lib/query-performance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [movies, series, genres] = await Promise.all([
    timedMovieQuery("home movies", () => prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { type: ContentType.MOVIE }] }, orderBy: { createdAt: "desc" }, take: 12 })),
    timedMovieQuery("home series", () => prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), { type: ContentType.SERIES }] }, orderBy: { createdAt: "desc" }, take: 12 })),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 18 }),
  ]);

  const heroMovies = [...movies, ...series].slice(0, 8).map((movie) => ({
    slug: movie.slug,
    titleRu: movie.titleRu,
    description: movie.description,
    year: movie.year,
    quality: movie.quality,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    kpRating: movie.kpRating,
    imdbRating: movie.imdbRating,
  }));
  const quickLinks = [
    { label: `Фильмы ${currentYear}`, href: `/movies/${currentYear}` },
    { label: `Сериалы ${currentYear}`, href: `/series/${currentYear}` },
    { label: "ТОП100", href: "/collections/top-100" },
    { label: "Последние обновления", href: "/latest" },
    { label: "Подборки", href: "/collections" },
  ];
  const catalogLinks = collectionLinksForYear(currentYear);

  return (
    <div className="container py-5 sm:py-7">
      <MovieHeroSlider movies={heroMovies} />

      <nav className="glass-panel section-glow mt-5 flex gap-2 overflow-x-auto rounded-3xl p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Быстрые ссылки">
        {quickLinks.map((item) => <Link key={item.href} href={item.href} className="mf-pill hover:border-[#e50914] hover:bg-[#e50914] hover:text-white">{item.label}</Link>)}
      </nav>

      {(catalogLinks.length > 0 || genres.length > 0) ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-2">
          {catalogLinks.map((item) => <Link key={item.href} href={item.href} className="text-xs font-bold text-[#777781] transition-colors hover:text-white">{item.label}</Link>)}
          {genres.slice(0, 10).map((genre) => <Link key={genre.slug} href={`/genre/${genre.slug}/${currentYear}`} className="text-xs font-bold text-[#777781] transition-colors hover:text-white">{genre.name} {currentYear}</Link>)}
        </div>
      ) : null}

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <div className="home-catalog-ad">
        <VibixBanner size="728x90" />
      </div>
    </div>
  );
}
