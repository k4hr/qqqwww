import { ContentType, type Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { SectionGrid } from "@/components/section-grid";
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
    <header className="glass-panel section-glow rounded-[24px] p-5 sm:p-7">
      <h1 className="text-3xl font-black tracking-[-.035em] text-white sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-[#a1a1aa]">Подборка REDFILM сформирована автоматически по популярности, рейтингам, качеству данных и доступности просмотра.</p>
    </header>
    <SectionGrid title={title} href={href} movies={movies} showSorts={false} />
  </div>;
}
