import type { Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVibixVideoByImdbIdResult, getVibixVideoByKpIdResult, type VibixVideo } from "@/lib/vibix";

type PosterLookupMovie = Pick<Movie, "id" | "titleRu" | "year" | "posterUrl" | "backdropUrl" | "kinopoiskId" | "imdbId" | "vibixId">;

export type PosterLookupResult = {
  posterUrl: string;
  backdropUrl: string | null;
  source: "vibix-kp" | "vibix-imdb";
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidPosterUrl(url?: string | null) {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:")
      && !parsed.hostname.includes("localhost")
      && !url.toLowerCase().includes("placeholder");
  } catch {
    return false;
  }
}

function posterFromVideo(video: VibixVideo | null, source: PosterLookupResult["source"], fallbackBackdrop?: string | null): PosterLookupResult | null {
  if (!isValidPosterUrl(video?.poster_url)) return null;
  return {
    posterUrl: video!.poster_url!,
    backdropUrl: isValidPosterUrl(video?.backdrop_url) ? video!.backdrop_url : fallbackBackdrop || null,
    source,
  };
}

export async function findMissingPoster(movie: PosterLookupMovie): Promise<PosterLookupResult | null> {
  if (isValidPosterUrl(movie.posterUrl)) return null;
  let backdrop = isValidPosterUrl(movie.backdropUrl) ? movie.backdropUrl : null;

  if (movie.kinopoiskId) {
    const result = await getVibixVideoByKpIdResult(movie.kinopoiskId);
    const found = posterFromVideo(result.video, "vibix-kp", backdrop);
    if (found) return found;
    if (isValidPosterUrl(result.video?.backdrop_url)) backdrop = result.video!.backdrop_url;
    if (result.rateLimited) return null;
    if (movie.imdbId) await sleep(750);
  }

  if (movie.imdbId) {
    const result = await getVibixVideoByImdbIdResult(movie.imdbId);
    const found = posterFromVideo(result.video, "vibix-imdb", backdrop);
    if (found) return found;
  }

  // External providers are intentionally opt-in. No generic image scraping is used.
  if (process.env.POSTER_LOOKUP_ENABLED !== "true" || !process.env.POSTER_LOOKUP_PROVIDER || !process.env.POSTER_LOOKUP_API_KEY) return null;
  return null;
}

export async function refreshMoviePoster(movieId: string) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, titleRu: true, year: true, posterUrl: true, backdropUrl: true, kinopoiskId: true, imdbId: true, vibixId: true },
  });
  if (!movie) return { status: "missing" as const };
  if (isValidPosterUrl(movie.posterUrl)) return { status: "unchanged" as const };

  const found = await findMissingPoster(movie);
  if (!found) return { status: "not-found" as const };

  await prisma.movie.update({
    where: { id: movie.id },
    data: {
      posterUrl: found.posterUrl,
      ...(found.backdropUrl && !isValidPosterUrl(movie.backdropUrl) ? { backdropUrl: found.backdropUrl } : {}),
    },
  });
  return { status: "updated" as const, source: found.source };
}
