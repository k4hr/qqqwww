import "server-only";

import { MovieArtworkType, type Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTmdbImages, tmdbImage, type TmdbImageItem } from "@/lib/tmdb";

const REDFILM_BACKDROP_FALLBACK = "/redfilm-cinematic-bg.webp";
const TMDB_BACKDROP_SIZE = "w1280";
const TMDB_POSTER_SIZE = "w500";
const TMDB_LOGO_SIZE = "w500";

type ArtworkInput = {
  type: MovieArtworkType;
  source: string;
  filePath?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  language?: string | null;
  voteAverage?: number | null;
  voteCount?: number | null;
};

export type ArtworkSyncResult = {
  ok: boolean;
  disabled?: boolean;
  movieId?: string;
  imported: number;
  updated: number;
  skipped: number;
  primaryBackdropUrl?: string | null;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isUsefulUrl(value: string | null | undefined) {
  return Boolean(value?.trim()) && !/^data:/i.test(value ?? "");
}

function aspect(width?: number | null, height?: number | null, fallback?: number | null) {
  if (width && height && height > 0) return width / height;
  return toNumber(fallback);
}

export function isWideBackdropArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  const ratio = aspect(input.width, input.height, input.aspectRatio);
  if (ratio !== null && (ratio < 1.45 || ratio > 2.55)) return false;
  if ((input.width ?? 0) > 0 && input.width! < 780) return false;
  if ((input.height ?? 0) > 0 && input.height! < 360) return false;
  return true;
}

function isValidPosterArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  const ratio = aspect(input.width, input.height, input.aspectRatio);
  if (ratio !== null && (ratio < 0.58 || ratio > 0.78)) return false;
  if ((input.width ?? 0) > 0 && input.width! < 300) return false;
  if ((input.height ?? 0) > 0 && input.height! < 450) return false;
  return true;
}

function isValidLogoArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  if ((input.width ?? 0) > 0 && input.width! < 220) return false;
  if ((input.height ?? 0) > 0 && input.height! < 70) return false;
  return true;
}

function scoreArtwork(input: ArtworkInput) {
  const pixels = (input.width ?? 0) * (input.height ?? 0);
  const language = input.language === "ru" ? 220 : input.language === "en" ? 120 : input.language ? 20 : 90;
  return pixels / 60_000 + (input.voteCount ?? 0) * 4 + (input.voteAverage ?? 0) * 8 + language;
}

function uniqueAndSort(items: ArtworkInput[], limit: number) {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.filePath || item.url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => scoreArtwork(b) - scoreArtwork(a))
    .slice(0, limit);
}

function tmdbArtwork(type: MovieArtworkType, item: TmdbImageItem, size: string): ArtworkInput | null {
  const filePath = item.file_path?.trim();
  const url = tmdbImage(filePath, size);
  if (!filePath || !url) return null;
  return {
    type,
    source: "tmdb",
    filePath,
    url,
    width: item.width ?? null,
    height: item.height ?? null,
    aspectRatio: item.aspect_ratio ?? null,
    language: item.iso_639_1 ?? null,
    voteAverage: item.vote_average ?? null,
    voteCount: item.vote_count ?? null,
  };
}

function collectTmdbArtwork(images: Awaited<ReturnType<typeof getTmdbImages>>) {
  const backdrops = uniqueAndSort(
    (images.backdrops ?? [])
      .map((item) => tmdbArtwork(MovieArtworkType.BACKDROP, item, TMDB_BACKDROP_SIZE))
      .filter((item): item is ArtworkInput => Boolean(item))
      .filter(isWideBackdropArtwork),
    12,
  );
  const posters = uniqueAndSort(
    (images.posters ?? [])
      .map((item) => tmdbArtwork(MovieArtworkType.POSTER, item, TMDB_POSTER_SIZE))
      .filter((item): item is ArtworkInput => Boolean(item))
      .filter(isValidPosterArtwork),
    12,
  );
  const logos = uniqueAndSort(
    (images.logos ?? [])
      .map((item) => tmdbArtwork(MovieArtworkType.LOGO, item, TMDB_LOGO_SIZE))
      .filter((item): item is ArtworkInput => Boolean(item))
      .filter(isValidLogoArtwork),
    4,
  );
  return [...backdrops, ...posters, ...logos];
}

function existingBackdropArtwork(movie: Pick<Movie, "backdropUrl">): ArtworkInput[] {
  return isUsefulUrl(movie.backdropUrl)
    ? [{ type: MovieArtworkType.BACKDROP, source: "movie", url: movie.backdropUrl!, sortOrder: 0, isPrimary: true } as ArtworkInput]
    : [];
}

async function fetchTmdbImagesWithRetry(movie: Pick<Movie, "tmdbId" | "type">, attempts = 3) {
  let delayMs = 900;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getTmdbImages(movie.tmdbId!, movie.type);
    } catch (error) {
      const status = (error as { status?: number }).status;
      const retryAfter = Number((error as { retryAfter?: string | null }).retryAfter);
      if (attempt >= attempts || (status && status !== 429 && status < 500)) throw error;
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delayMs);
      delayMs *= 2;
    }
  }
  return { backdrops: [], posters: [], logos: [] };
}

async function upsertArtwork(movieId: string, artworks: ArtworkInput[]) {
  let imported = 0;
  let updated = 0;

  for (const [index, artwork] of artworks.entries()) {
    const saved = await prisma.movieArtwork.upsert({
      where: { movieId_type_url: { movieId, type: artwork.type, url: artwork.url } },
      create: {
        movieId,
        type: artwork.type,
        source: artwork.source,
        filePath: artwork.filePath ?? null,
        url: artwork.url,
        width: artwork.width ?? null,
        height: artwork.height ?? null,
        aspectRatio: artwork.aspectRatio ?? null,
        language: artwork.language ?? null,
        voteAverage: artwork.voteAverage ?? null,
        voteCount: artwork.voteCount ?? null,
        sortOrder: index,
        isPrimary: artwork.type === MovieArtworkType.BACKDROP && index === 0,
      },
      update: {
        source: artwork.source,
        filePath: artwork.filePath ?? null,
        width: artwork.width ?? null,
        height: artwork.height ?? null,
        aspectRatio: artwork.aspectRatio ?? null,
        language: artwork.language ?? null,
        voteAverage: artwork.voteAverage ?? null,
        voteCount: artwork.voteCount ?? null,
        sortOrder: index,
      },
      select: { createdAt: true, updatedAt: true },
    });
    if (saved.createdAt.getTime() === saved.updatedAt.getTime()) imported += 1;
    else updated += 1;
  }

  return { imported, updated };
}

async function setPrimaryBackdrop(movie: Pick<Movie, "id" | "backdropUrl">) {
  const primary = await prisma.movieArtwork.findFirst({
    where: { movieId: movie.id, type: MovieArtworkType.BACKDROP },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { voteCount: "desc" }],
  });
  if (!primary || !isWideBackdropArtwork(primary)) return movie.backdropUrl ?? null;

  await prisma.movieArtwork.updateMany({
    where: { movieId: movie.id, type: MovieArtworkType.BACKDROP, id: { not: primary.id } },
    data: { isPrimary: false },
  });
  await prisma.movieArtwork.update({ where: { id: primary.id }, data: { isPrimary: true } });

  if (movie.backdropUrl !== primary.url) {
    await prisma.movie.update({ where: { id: movie.id }, data: { backdropUrl: primary.url } });
  }
  return primary.url;
}

export async function syncMovieArtwork(movieId: string): Promise<ArtworkSyncResult> {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, tmdbId: true, type: true, backdropUrl: true },
  });
  if (!movie) return { ok: false, imported: 0, updated: 0, skipped: 1, error: "Movie not found" };
  if (!process.env.TMDB_API_KEY?.trim()) return { ok: true, disabled: true, movieId, imported: 0, updated: 0, skipped: 1, primaryBackdropUrl: movie.backdropUrl };
  if (!movie.tmdbId?.trim()) return { ok: true, movieId, imported: 0, updated: 0, skipped: 1, primaryBackdropUrl: movie.backdropUrl };

  try {
    const images = await fetchTmdbImagesWithRetry(movie);
    const artworks = uniqueAndSort([...existingBackdropArtwork(movie), ...collectTmdbArtwork(images)], 28);
    const { imported, updated } = await upsertArtwork(movie.id, artworks);
    const primaryBackdropUrl = await setPrimaryBackdrop(movie);
    return { ok: true, movieId, imported, updated, skipped: Math.max(0, 28 - artworks.length), primaryBackdropUrl };
  } catch (error) {
    return { ok: false, movieId, imported: 0, updated: 0, skipped: 1, error: error instanceof Error ? error.message : "Unknown artwork sync error" };
  }
}

export async function syncMovieArtworkBatch({ limit = 25, concurrency = 2 }: { limit?: number; concurrency?: number } = {}) {
  if (!process.env.TMDB_API_KEY?.trim()) {
    return { ok: true, disabled: true, processed: 0, imported: 0, updated: 0, skipped: 0, failed: 0, message: "TMDB_API_KEY не указан. Artwork enrichment отключён." };
  }
  const movies = await prisma.movie.findMany({
    where: { isPublished: true, tmdbId: { not: null } },
    select: { id: true },
    orderBy: [
      { isHeroEligible: "desc" },
      { isHomeEligible: "desc" },
      { isTrendingEligible: "desc" },
      { views: "desc" },
      { updatedAt: "desc" },
    ],
    take: Math.max(1, Math.min(limit, 100)),
  });

  const result = { ok: true, disabled: false, processed: 0, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, 4));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (index < movies.length) {
      const movie = movies[index++];
      const item = await syncMovieArtwork(movie.id);
      result.processed += 1;
      result.imported += item.imported;
      result.updated += item.updated;
      result.skipped += item.skipped;
      if (!item.ok) {
        result.failed += 1;
        if (item.error && result.errors.length < 10) result.errors.push(item.error);
      }
      await sleep(350);
    }
  }));

  return result;
}

export async function getWatchArtwork(movieId: string, fallbackBackdropUrl?: string | null) {
  const artworks = await prisma.movieArtwork.findMany({
    where: { movieId },
    orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 36,
  });
  const backdrop = artworks.find((item) => item.type === MovieArtworkType.BACKDROP && item.isPrimary && isWideBackdropArtwork(item))
    ?? artworks.find((item) => item.type === MovieArtworkType.BACKDROP && isWideBackdropArtwork(item));
  return {
    backdropUrl: backdrop?.url || fallbackBackdropUrl || REDFILM_BACKDROP_FALLBACK,
    artworks,
  };
}

export function redfilmBackdropFallback() {
  return REDFILM_BACKDROP_FALLBACK;
}

export type WatchArtwork = Awaited<ReturnType<typeof getWatchArtwork>>;
