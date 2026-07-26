import { MovieArtworkType } from "@prisma/client";
import { syncMovieArtwork } from "@/lib/movie-artwork";
import { prisma } from "@/lib/prisma";

function requestedSlugs() {
  return (process.env.ARTWORK_SYNC_SLUGS ?? process.argv.slice(2).join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function inspect(slug: string) {
  const movie = await prisma.movie.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      titleRu: true,
      kinopoiskId: true,
      imdbId: true,
      posterUrl: true,
      backdropUrl: true,
      lastExternalEnrichmentAt: true,
    },
  });
  if (!movie) return { slug, ok: false, error: "Movie not found" };

  const result = await syncMovieArtwork(movie.id);
  const refreshed = await prisma.movie.findUnique({
    where: { id: movie.id },
    select: { posterUrl: true, backdropUrl: true, lastExternalEnrichmentAt: true },
  });
  const artworks = await prisma.movieArtwork.findMany({
    where: { movieId: movie.id, type: { in: [MovieArtworkType.BACKDROP, MovieArtworkType.POSTER] } },
    orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { source: "asc" }],
    select: {
      type: true,
      source: true,
      url: true,
      width: true,
      height: true,
      aspectRatio: true,
      isPrimary: true,
      updatedAt: true,
    },
  });

  return {
    slug,
    title: movie.titleRu,
    identifiers: { kinopoiskId: movie.kinopoiskId, imdbId: movie.imdbId },
    before: { posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl, lastExternalEnrichmentAt: movie.lastExternalEnrichmentAt },
    sync: result,
    after: refreshed,
    artworks,
  };
}

async function main() {
  const slugs = requestedSlugs();
  if (!slugs.length) {
    throw new Error("Укажи ARTWORK_SYNC_SLUGS=slug-1,slug-2 или передай slug аргументами.");
  }

  const output = [];
  for (const slug of slugs) output.push(await inspect(slug));
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error("[ArtworkSyncSlugs] Fatal error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
