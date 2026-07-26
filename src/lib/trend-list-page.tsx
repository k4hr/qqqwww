import { ContentType, type Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/movie-card";
import { prisma } from "@/lib/prisma";

type Props = { title: string; href: string; type?: ContentType; year?: number; mode: "popular" | "best" | "trending" };

export async function TrendListPage({ title, href, type, year, mode }: Props) {
  if (year !== undefined && (!Number.isInteger(year) || year < 1880 || year > new Date().getFullYear() + 5)) notFound();
  const where: Prisma.MovieWhereInput = {
    isPublished: true,
    isCatalogAllowed: true,
    vibixAvailable: true,
    isHomeEligible: true,
    ...(type ? { type } : {}),
    ...(year ? { year } : {}),
    ...(mode === "trending" ? { isTrendingEligible: true } : {}),
  };
  const orderBy: Prisma.MovieOrderByWithRelationInput[] = mode === "best"
    ? [{ qualityScore: "desc" }, { homeScore: "desc" }]
    : mode === "trending"
      ? [{ trendScore: "desc" }, { homeScore: "desc" }]
      : [{ homeScore: "desc" }, { trendScore: "desc" }];
  const movies = await prisma.movie.findMany({ where, orderBy, take: 60 });
  return <div className="container py-6 sm:py-8">
    <header className="rf-catalog-intro mb-7">
      <h1 className="rf-page-title">{title}</h1>
      <p className="rf-copy mt-3 max-w-3xl">Подборка REDFILM сформирована по популярности, рейтингам и доступности просмотра.</p>
    </header>
    <div className="movie-grid">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
  </div>;
}
