import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { HomeCatalogTools } from "@/components/home-catalog-tools";
import { VibixBanner } from "@/components/vibix-banner";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { rankPopularMovies } from "@/lib/catalog-rank";
import { timedMovieQuery } from "@/lib/query-performance";

export const dynamic = "force-dynamic";
export const metadata = { title: "REDFILM — фильмы и сериалы онлайн", description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.", alternates: { canonical: "/" } };

const publicWhere = [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere()];

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [movieCandidates, seriesCandidates, yearNew, newMovies, newSeries, topRated] = await Promise.all([
    timedMovieQuery("home popular movie candidates", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { type: ContentType.MOVIE }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 120 })),
    timedMovieQuery("home popular series candidates", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { type: ContentType.SERIES }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 120 })),
    timedMovieQuery("home year new", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { year: currentYear, type: { in: [ContentType.MOVIE, ContentType.SERIES] } }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 12 })),
    timedMovieQuery("home new movies", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { type: ContentType.MOVIE }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 12 })),
    timedMovieQuery("home new series", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { type: ContentType.SERIES }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 12 })),
    timedMovieQuery("home top rated", () => prisma.movie.findMany({ where: { AND: [...publicWhere, { type: { in: [ContentType.MOVIE, ContentType.SERIES] } }] }, orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }, { createdAt: "desc" }], take: 12 })),
  ]);
  const popularMovies = rankPopularMovies(movieCandidates, 12);
  const popularSeries = rankPopularMovies(seriesCandidates, 12);
  const heroMovies = [...popularMovies.slice(0, 4), ...popularSeries.slice(0, 4)].map((movie) => ({
    slug: movie.slug, titleRu: movie.titleRu, description: movie.description, year: movie.year,
    quality: movie.quality, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl,
    kpRating: movie.kpRating, imdbRating: movie.imdbRating,
  }));

  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={heroMovies} />
    <HomeCatalogTools />
    <SectionGrid title="Популярные фильмы" href="/movies?sort=popular" movies={popularMovies} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные сериалы" href="/series?sort=popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title={`Новинки ${currentYear}`} href={`/year/${currentYear}`} movies={yearNew} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner size="728x90" /></div>
    <SectionGrid title="Новые фильмы" href="/movies?sort=new" movies={newMovies} showSorts={false} mobileCarousel />
    <SectionGrid title="Новые сериалы" href="/series?sort=new" movies={newSeries} showSorts={false} mobileCarousel />
    <SectionGrid title="ТОП по рейтингу" href="/top" movies={topRated} showSorts={false} mobileCarousel />
  </div>;
}
