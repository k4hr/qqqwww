import { type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getQualityBlockReasons, hasPlayableSource } from "@/lib/home-quality-score";
import { prisma } from "@/lib/prisma";

type LoadedMovie = Prisma.MovieGetPayload<{ include: { genres: { include: { genre: true } } } }>;

function serialize(movie: LoadedMovie) {
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.titleRu,
    year: movie.year,
    kpId: movie.kinopoiskId,
    imdbId: movie.imdbId,
    poster: Boolean(movie.posterUrl?.trim()),
    backdrop: Boolean(movie.backdropUrl?.trim()),
    iframe: Boolean(movie.vibixIframeUrl?.trim()),
    embedCode: Boolean(movie.vibixEmbedCode?.trim()),
    hasPlayer: hasPlayableSource(movie),
    kpRating: movie.kpRating,
    kpVotes: movie.kpVotes,
    imdbRating: movie.imdbRating,
    imdbVotes: movie.imdbVotes,
    homeScore: movie.homeScore,
    qualityScore: movie.qualityScore,
    isHomeEligible: movie.isHomeEligible,
    isHeroEligible: movie.isHeroEligible,
    reasons: getQualityBlockReasons(movie),
  };
}

function loadMovies(where: Prisma.MovieWhereInput, take = 1000) {
  return prisma.movie.findMany({ where, include: { genres: { include: { genre: true } } }, orderBy: [{ homeScore: "asc" }, { updatedAt: "desc" }], take });
}

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "english") {
    const movies = await loadMovies({ isPublished: true }, 1000);
    return NextResponse.json(movies.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).slice(0, 100).map(serialize));
  }
  if (kind === "breakdown" || kind === "blocked") {
    const movies = await loadMovies({ isPublished: true, isHomeEligible: false }, kind === "breakdown" ? 1000 : 100);
    const breakdown: Record<string, number> = {};
    const items = movies.map((movie) => {
      const item = serialize(movie);
      for (const reason of item.reasons) breakdown[reason] = (breakdown[reason] ?? 0) + 1;
      return item;
    });
    return NextResponse.json({ breakdown, items: items.slice(0, 100) });
  }
  const where = kind === "poster" ? { isPublished: true, OR: [{ posterUrl: null }, { posterUrl: "" }] }
    : kind === "backdrop" ? { isPublished: true, OR: [{ backdropUrl: null }, { backdropUrl: "" }] }
      : { isPublished: true, OR: [{ isQualityDataComplete: false }, { posterUrl: null }, { posterUrl: "" }, { backdropUrl: null }, { backdropUrl: "" }, { vibixAvailable: false }] };
  const movies = await loadMovies(where, 100);
  return NextResponse.json(movies.map(serialize));
}
