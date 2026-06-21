import { ContentType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ClientLibrary } from "@/components/client-library";
import { MovieHeroSlider } from "@/components/movie-hero-slider";
import { SectionGrid } from "@/components/section-grid";
import { VibixBanner } from "@/components/vibix-banner";
import { isValidCinematicImage } from "@/lib/home-quality-score";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Фильмы и сериалы онлайн: популярные картины, новинки, рейтинги и подборки REDFILM.",
  alternates: { canonical: "/" },
};

const getHomeMovies = unstable_cache(async (currentYear: number) => {
  const publicWhere = { isPublished: true, isCatalogAllowed: true, vibixAvailable: true, isHomeEligible: true } as const;
  return Promise.all([
    prisma.movie.findMany({ where: { ...publicWhere, isHeroEligible: true }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 8 }),
    prisma.movie.findMany({ where: { ...publicWhere, type: ContentType.MOVIE }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, type: ContentType.SERIES }, orderBy: [{ homeScore: "desc" }, { trendScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, isTrendingEligible: true }, orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, year: { in: [currentYear - 1, currentYear, currentYear + 1] } }, orderBy: [{ trendScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({ where: { ...publicWhere, isEvergreenEligible: true }, orderBy: [{ evergreenScore: "desc" }, { homeScore: "desc" }], take: 12 }),
    prisma.movie.findMany({
      where: { ...publicWhere, backdropUrl: { not: null }, OR: [{ kpVotes: { gte: 1_000 } }, { imdbVotes: { gte: 1_000 } }, { tmdbVotes: { gte: 1_000 } }] },
      orderBy: [{ homeScore: "desc" }, { qualityScore: "desc" }],
      take: 30,
    }),
  ]);
}, ["redfilm-home-scores-v1"], { revalidate: 600 });

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [heroMovies, popularMovies, popularSeries, trending, newest, best, heroFallback] = await getHomeMovies(currentYear);
  const featured = [...heroMovies, ...heroFallback.filter((movie) => /[а-яё]/iu.test(movie.titleRu) && isValidCinematicImage(movie.posterUrl) && isValidCinematicImage(movie.backdropUrl))]
    .filter((movie, index, all) => all.findIndex((item) => item.id === movie.id) === index)
    .slice(0, 8);
  return <div className="container py-4 sm:py-7">
    <MovieHeroSlider movies={featured} />
    <SectionGrid title="В тренде" href="/trending" movies={trending} showSorts={false} mobileCarousel />
    <SectionGrid title="Популярные фильмы" href="/movies?sort=popular" movies={popularMovies} showSorts={false} mobileCarousel />
    <ClientLibrary mode="recent-home" />
    <SectionGrid title="Популярные сериалы" href="/series?sort=popular" movies={popularSeries} showSorts={false} mobileCarousel />
    <SectionGrid title={`Новинки ${currentYear}`} href={`/year/${currentYear}`} movies={newest} showSorts={false} mobileCarousel />
    <div className="home-catalog-ad"><VibixBanner size="728x90" /></div>
    <SectionGrid title="Проверенная классика" href="/top" movies={best} showSorts={false} mobileCarousel />
  </div>;
}
