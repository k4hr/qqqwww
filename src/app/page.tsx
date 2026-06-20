import { ContentType, type Movie } from "@prisma/client";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { buildHomeCatalogWhere, isSafeForHome } from "@/lib/catalog-safety";
import { getMovieFreshnessScore, rankPopularMovies } from "@/lib/catalog-rank";
import { prisma } from "@/lib/prisma";
import { timedMovieQuery } from "@/lib/query-performance";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

const homeWhere = buildHomeCatalogWhere();

function newestSafe<T extends Movie>(movies: T[], limit = 12) {
  return movies.filter(isSafeForHome).sort((a, b) => getMovieFreshnessScore(b) - getMovieFreshnessScore(a)).slice(0, limit);
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [movieCandidates, seriesCandidates, yearCandidates, newMovieCandidates, newSeriesCandidates, ratedCandidates] = await Promise.all([
    timedMovieQuery("home popular movie candidates", () => prisma.movie.findMany({ where: { AND: [homeWhere, { type: ContentType.MOVIE }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 240 })),
    timedMovieQuery("home popular series candidates", () => prisma.movie.findMany({ where: { AND: [homeWhere, { type: ContentType.SERIES }] }, orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }], take: 240 })),
    timedMovieQuery("home year new candidates", () => prisma.movie.findMany({ where: { AND: [homeWhere, { year: currentYear, type: { in: [ContentType.MOVIE, ContentType.SERIES] } }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 120 })),
    timedMovieQuery("home new movie candidates", () => prisma.movie.findMany({ where: { AND: [homeWhere, { type: ContentType.MOVIE }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 120 })),
    timedMovieQuery("home new series candidates", () => prisma.movie.findMany({ where: { AND: [homeWhere, { type: ContentType.SERIES }] }, orderBy: [{ vibixUploadedAt: "desc" }, { createdAt: "desc" }], take: 120 })),
    timedMovieQuery("home top rated candidates", () => prisma.movie.findMany({
      where: { AND: [homeWhere, { type: { in: [ContentType.MOVIE, ContentType.SERIES] } }, { OR: [{ kpRating: { gte: 6.5 } }, { imdbRating: { gte: 6.5 } }] }] },
      orderBy: [{ kpRating: "desc" }, { imdbRating: "desc" }, { year: "desc" }],
      take: 180,
    })),
  ]);

  const popularMovies = rankPopularMovies(movieCandidates.filter(isSafeForHome), 12);
  const popularSeries = rankPopularMovies(seriesCandidates.filter(isSafeForHome), 12);
  const yearNew = newestSafe(yearCandidates);
  const newMovies = newestSafe(newMovieCandidates);
  const newSeries = newestSafe(newSeriesCandidates);
  const topRated = ratedCandidates
    .filter(isSafeForHome)
    .sort((a, b) => Math.max(b.kpRating ?? 0, b.imdbRating ?? 0) - Math.max(a.kpRating ?? 0, a.imdbRating ?? 0)
      || b.year - a.year
      || Number(/full\s*hd|1080|\bhd\b/i.test(b.quality)) - Number(/full\s*hd|1080|\bhd\b/i.test(a.quality)))
    .slice(0, 12);
  const heroMovies = [...popularMovies.slice(0, 4), ...popularSeries.slice(0, 4)].map((movie) => ({
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

  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={heroMovies} />
    <SectionGrid title="Популярные фильмы" href="/movies?sort=popular" movies={popularMovies} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные сериалы" href="/series?sort=popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title={`Новинки ${currentYear}`} href={`/year/${currentYear}`} movies={yearNew} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner size="728x90" /></div>
    <SectionGrid title="Новые фильмы" href="/movies?sort=new" movies={newMovies} showSorts={false} mobileCarousel />
    <SectionGrid title="Новые сериалы" href="/series?sort=new" movies={newSeries} showSorts={false} mobileCarousel />
    <SectionGrid title="ТОП по рейтингу" href="/top" movies={topRated} showSorts={false} mobileCarousel />
  </div>;
}
