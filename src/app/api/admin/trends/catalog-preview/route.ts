import { NextResponse } from "next/server";
import { ContentType } from "@prisma/client";
import { getTopCatalogPreview } from "@/lib/catalog-query";
import { hasCatalogPlayer, getCatalogBlockReasons } from "@/lib/catalog-score";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("target") === "top" ? "top" : url.searchParams.get("target") === "fresh" ? "fresh" : "popular";
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "series" || typeParam === "SERIES" ? ContentType.SERIES : typeParam === "cartoon" || typeParam === "cartoons" || typeParam === "CARTOON" ? ContentType.CARTOON : typeParam === "anime" || typeParam === "ANIME" ? ContentType.ANIME : typeParam === "movie" || typeParam === "MOVIE" ? ContentType.MOVIE : undefined;
  const items = await getTopCatalogPreview(target, type, 50);
  const detailed = await prisma.movie.findMany({ where: { id: { in: items.map((item) => item.id) } }, include: { genres: { include: { genre: true } } } });
  const detailedById = new Map(detailed.map((item) => [item.id, item]));
  return NextResponse.json({
    target,
    type: type ?? "all",
    count: items.length,
    items: items.map((item) => {
      const full = detailedById.get(item.id);
      return {
        title: item.titleRu,
        type: item.type,
        year: item.year,
        kpId: item.kinopoiskId,
        imdbId: item.imdbId,
        kpRating: item.kpRating,
        kpVotes: item.kpVotes,
        imdbRating: item.imdbRating,
        imdbVotes: item.imdbVotes,
        catalogScore: item.catalogScore,
        popularScore: item.popularScore,
        topScore: item.topScore,
        freshScore: item.freshScore,
        hasPlayer: hasCatalogPlayer(item),
        poster: Boolean(item.posterUrl?.trim()),
        backdrop: Boolean(item.backdropUrl?.trim()),
        reasons: full ? getCatalogBlockReasons(full) : [],
      };
    }),
  });
}
