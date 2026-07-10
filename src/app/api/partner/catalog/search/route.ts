import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/collaboration/auth";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export async function GET(request: Request) {
  const auth = await getPartnerSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const type = url.searchParams.get("type") || "";
  if (q.length < 2) return NextResponse.json({ movies: [] });
  const movies = await prisma.movie.findMany({
    where: {
      AND: [
        vibixPublicMovieWhere,
        { titleRu: { contains: q, mode: "insensitive" } },
        ["MOVIE", "SERIES", "CARTOON", "ANIME"].includes(type) ? { type: type as "MOVIE" | "SERIES" | "CARTOON" | "ANIME" } : {},
      ],
    },
    select: { id: true, titleRu: true, year: true, type: true, posterUrl: true, kpRating: true, imdbRating: true },
    orderBy: [{ homeScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }],
    take: 24,
  });
  return NextResponse.json({ movies });
}
