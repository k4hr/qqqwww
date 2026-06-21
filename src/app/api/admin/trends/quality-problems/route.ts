import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "english") {
    const movies = await prisma.movie.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, titleRu: true, year: true, qualityScore: true, posterUrl: true, backdropUrl: true, vibixAvailable: true },
    });
    return NextResponse.json(movies.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).slice(0, 100));
  }
  const where = kind === "poster" ? { isPublished: true, OR: [{ posterUrl: null }, { posterUrl: "" }] }
    : kind === "backdrop" ? { isPublished: true, OR: [{ backdropUrl: null }, { backdropUrl: "" }] }
      : kind === "blocked" ? { isPublished: true, isHomeEligible: false }
        : { isPublished: true, OR: [{ isQualityDataComplete: false }, { posterUrl: null }, { posterUrl: "" }, { backdropUrl: null }, { backdropUrl: "" }, { vibixAvailable: false }] };
  const movies = await prisma.movie.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, slug: true, titleRu: true, year: true, qualityScore: true, posterUrl: true, backdropUrl: true, vibixAvailable: true },
  });
  return NextResponse.json(movies);
}
