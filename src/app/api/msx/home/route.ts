import { NextResponse } from "next/server";
import { getTvHome, serializeTvMovie, TV_REVALIDATE_SECONDS } from "@/lib/tv";

export const revalidate = TV_REVALIDATE_SECONDS;

export async function GET() {
  const home = await getTvHome();
  return NextResponse.json({
    ok: true,
    title: "REDFILM TV",
    startUrl: "/msx",
    hero: home.hero ? serializeTvMovie(home.hero) : null,
    sections: home.sections.map((section) => ({
      id: section.id,
      title: section.title,
      movies: section.movies.map(serializeTvMovie),
    })),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
