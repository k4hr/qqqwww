import "server-only";

import { MovieArtworkType, type Movie, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTmdbImages, tmdbImage, type TmdbImageItem } from "@/lib/tmdb";

const REDFILM_BACKDROP_FALLBACK = "/redfilm-cinematic-bg.webp";
const TMDB_BACKDROP_SIZE = "w1280";
const TMDB_POSTER_SIZE = "w500";
const TMDB_LOGO_SIZE = "w500";
const MIN_BACKDROP_RATIO = 1.5;
const MAX_BACKDROP_RATIO = 2.55;
const ARTWORK_STALE_DAYS = 45;

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
  sortOrder?: number;
  isPrimary?: boolean;
};

export type ArtworkSyncResult = {
  ok: boolean;
  disabled?: boolean;
  movieId?: string;
  imported: number;
  updated: number;
  deleted: number;
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
  if (width != null && height != null && height > 0) return width / height;
  return toNumber(fallback);
}

export function isWideBackdropArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  const ratio = aspect(input.width, input.height, input.aspectRatio);
  if (ratio === null || ratio < MIN_BACKDROP_RATIO || ratio > MAX_BACKDROP_RATIO) return false;
  if ((input.width ?? 0) > 0 && input.width! < 780) return false;
  if ((input.height ?? 0) > 0 && input.height! < 360) return false;
  return true;
}

function isValidPosterArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  const ratio = aspect(input.width, input.height, input.aspectRatio);
  if (ratio === null || ratio < 0.58 || ratio > 0.78) return false;
  if ((input.width ?? 0) > 0 && input.width! < 300) return false;
  if ((input.height ?? 0) > 0 && input.height! < 450) return false;
  return true;
}

function isValidLogoArtwork(input: Pick<ArtworkInput, "url" | "width" | "height" | "aspectRatio">) {
  if (!isUsefulUrl(input.url)) return false;
  if (input.width == null || input.height == null || input.height <= 0) return false;
  if (input.width < 220 || input.height < 70) return false;
  return true;
}

function sourcePriority(source: string) {
  const normalized = source.toLocaleUpperCase("en-US");
  if (normalized === "MANUAL") return 500;
  if (normalized === "TMDB") return 400;
  if (normalized === "VIBIX") return 300;
  if (normalized === "LEGACY_VALIDATED") return 200;
  return 100;
}

function scoreArtwork(input: ArtworkInput) {
  const pixels = (input.width ?? 0) * (input.height ?? 0);
  const language = input.language === "ru" ? 220 : input.language === "en" ? 120 : input.language ? 20 : 90;
  return sourcePriority(input.source) + pixels / 60_000 + (input.voteCount ?? 0) * 4 + (input.voteAverage ?? 0) * 8 + language - (input.sortOrder ?? 0);
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
    source: "TMDB",
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
  throw new Error("TMDB images retry exhausted");
}

async function reconcileTmdbArtwork(movieId: string, artworks: ArtworkInput[]) {
  const freshUrls = artworks.map((artwork) => artwork.url);
  const existing = await prisma.movieArtwork.findMany({
    where: { movieId, source: { equals: "TMDB", mode: "insensitive" } },
    select: { id: true, url: true },
  });
  const existingUrls = new Set(existing.map((item) => item.url));
  let imported = 0;
  let updated = 0;
  let deleted = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, artwork] of artworks.entries()) {
      if (existingUrls.has(artwork.url)) updated += 1;
      else imported += 1;
      await tx.movieArtwork.upsert({
        where: { movieId_type_url: { movieId, type: artwork.type, url: artwork.url } },
        create: {
          movieId,
          type: artwork.type,
          source: "TMDB",
          filePath: artwork.filePath ?? null,
          url: artwork.url,
          width: artwork.width ?? null,
          height: artwork.height ?? null,
          aspectRatio: artwork.aspectRatio ?? null,
          language: artwork.language ?? null,
          voteAverage: artwork.voteAverage ?? null,
          voteCount: artwork.voteCount ?? null,
          sortOrder: index,
          isPrimary: false,
        },
        update: {
          source: "TMDB",
          filePath: artwork.filePath ?? null,
          width: artwork.width ?? null,
          height: artwork.height ?? null,
          aspectRatio: artwork.aspectRatio ?? null,
          language: artwork.language ?? null,
          voteAverage: artwork.voteAverage ?? null,
          voteCount: artwork.voteCount ?? null,
          sortOrder: index,
        },
      });
    }

    const staleIds = existing.filter((item) => !freshUrls.includes(item.url)).map((item) => item.id);
    if (staleIds.length) {
      const removed = await tx.movieArtwork.deleteMany({ where: { id: { in: staleIds } } });
      deleted = removed.count;
    }
    await tx.movie.update({ where: { id: movieId }, data: { lastExternalEnrichmentAt: new Date() } });
  });

  return { imported, updated, deleted };
}

async function setPrimaryBackdrop(movie: Pick<Movie, "id" | "backdropUrl">) {
  const allBackdrops = await prisma.movieArtwork.findMany({
    where: { movieId: movie.id, type: MovieArtworkType.BACKDROP },
  });
  const winner = allBackdrops
    .filter(isWideBackdropArtwork)
    .sort((a, b) => scoreArtwork(b) - scoreArtwork(a))[0];

  await prisma.$transaction(async (tx) => {
    await tx.movieArtwork.updateMany({
      where: { movieId: movie.id, type: MovieArtworkType.BACKDROP },
      data: { isPrimary: false },
    });
    if (winner) {
      await tx.movieArtwork.update({ where: { id: winner.id }, data: { isPrimary: true } });
      if (movie.backdropUrl !== winner.url) await tx.movie.update({ where: { id: movie.id }, data: { backdropUrl: winner.url } });
    }
  });
  return winner?.url ?? null;
}

export async function syncMovieArtwork(movieId: string): Promise<ArtworkSyncResult> {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, tmdbId: true, type: true, backdropUrl: true },
  });
  if (!movie) return { ok: false, imported: 0, updated: 0, deleted: 0, skipped: 1, error: "Movie not found" };
  if (!process.env.TMDB_API_KEY?.trim()) return { ok: true, disabled: true, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, primaryBackdropUrl: null };
  if (!movie.tmdbId?.trim()) return { ok: true, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, primaryBackdropUrl: null };

  try {
    const images = await fetchTmdbImagesWithRetry(movie);
    const artworks = collectTmdbArtwork(images);
    const { imported, updated, deleted } = await reconcileTmdbArtwork(movie.id, artworks);
    const primaryBackdropUrl = await setPrimaryBackdrop(movie);
    return { ok: true, movieId, imported, updated, deleted, skipped: artworks.length ? 0 : 1, primaryBackdropUrl };
  } catch (error) {
    return { ok: false, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, error: error instanceof Error ? error.message : "Unknown artwork sync error" };
  }
}

type ArtworkBatchOptions = { limit?: number; concurrency?: number; cursor?: string };

type ArtworkBatchPhase = 1 | 2 | 3 | 4;

function parseArtworkCursor(cursor?: string): { phase: ArtworkBatchPhase; id: string } {
  const match = cursor?.match(/^([1-4]):(.*)$/);
  if (match) return { phase: Number(match[1]) as ArtworkBatchPhase, id: match[2] };
  // Backward compatibility with the previous raw Movie.id cursor.
  return { phase: 1, id: cursor?.trim() ?? "" };
}

function artworkPhaseWhere(phase: ArtworkBatchPhase, staleBefore: Date): Prisma.MovieWhereInput {
  if (phase === 1) return { artworks: { none: {} } };
  if (phase === 2) return { AND: [{ artworks: { some: {} } }, { artworks: { none: { type: MovieArtworkType.BACKDROP } } }] };
  if (phase === 3) return { artworks: { some: { source: { equals: "TMDB", mode: "insensitive" }, updatedAt: { lt: staleBefore } } } };
  return { OR: [{ isHeroEligible: true }, { isHomeEligible: true }, { isTrendingEligible: true }] };
}

async function selectArtworkBatch(limit: number, cursor?: string) {
  const selected: Array<{ id: string }> = [];
  const staleBefore = new Date(Date.now() - ARTWORK_STALE_DAYS * 86_400_000);
  let { phase, id } = parseArtworkCursor(cursor);
  let nextCursor: string | undefined;

  while (selected.length < limit && phase <= 4) {
    const remaining = limit - selected.length;
    const rows = await prisma.movie.findMany({
      where: {
        AND: [
          { isPublished: true, tmdbId: { not: null }, id: id ? { gt: id } : undefined },
          artworkPhaseWhere(phase, staleBefore),
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: remaining,
    });

    selected.push(...rows);
    if (rows.length) {
      id = rows.at(-1)!.id;
      nextCursor = `${phase}:${id}`;
    }
    if (rows.length === remaining) break;
    phase = (phase + 1) as ArtworkBatchPhase;
    id = "";
    nextCursor = phase <= 4 ? `${phase}:` : undefined;
  }

  return { movies: selected, nextCursor };
}

export async function syncMovieArtworkBatch({ limit = 25, concurrency = 2, cursor }: ArtworkBatchOptions = {}) {
  if (!process.env.TMDB_API_KEY?.trim()) {
    return { ok: true, disabled: true, processed: 0, imported: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, nextCursor: cursor, movieIds: [] as string[], message: "TMDB_API_KEY не указан. Artwork enrichment отключён." };
  }
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const selection = await selectArtworkBatch(safeLimit, cursor);
  const movies = selection.movies;
  const result = { ok: true, disabled: false, processed: 0, imported: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, nextCursor: selection.nextCursor, movieIds: movies.map((movie) => movie.id), errors: [] as string[] };
  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, 4));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (index < movies.length) {
      const movie = movies[index++];
      const item = await syncMovieArtwork(movie.id);
      result.processed += 1;
      result.imported += item.imported;
      result.updated += item.updated;
      result.deleted += item.deleted;
      result.skipped += item.skipped;
      if (!item.ok) {
        result.failed += 1;
        if (item.error && result.errors.length < 10) result.errors.push(`${movie.id}: ${item.error}`);
      }
      await sleep(350);
    }
  }));
  return result;
}

export async function getWatchArtwork(movieId: string, fallbackBackdropUrl?: string | null) {
  const [artworks, movie] = await Promise.all([
    prisma.movieArtwork.findMany({
      where: { movieId },
      orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { sortOrder: "asc" }],
      take: 36,
    }),
    prisma.movie.findUnique({ where: { id: movieId }, select: { posterUrl: true } }),
  ]);
  const validBackdrops = artworks.filter((item) => item.type === MovieArtworkType.BACKDROP && isWideBackdropArtwork(item));
  const validArtwork = artworks.filter((item) => {
    if (item.type === MovieArtworkType.BACKDROP) return isWideBackdropArtwork(item);
    if (item.type === MovieArtworkType.POSTER) return isValidPosterArtwork(item);
    return isValidLogoArtwork(item);
  });
  const primary = validBackdrops.find((item) => item.isPrimary) ?? validBackdrops.sort((a, b) => scoreArtwork(b) - scoreArtwork(a))[0];
  const validatedLegacy = validBackdrops.find((item) => item.url === fallbackBackdropUrl && /legacy|movie/i.test(item.source));
  const backdrop = primary ?? validatedLegacy;
  return {
    backdropUrl: backdrop?.url ?? REDFILM_BACKDROP_FALLBACK,
    posterUrl: movie?.posterUrl ?? null,
    backdropSource: backdrop ? (/legacy|movie/i.test(backdrop.source) ? "LEGACY_VALIDATED" as const : "MOVIE_ARTWORK" as const) : "REDFILM_FALLBACK" as const,
    artworks: validArtwork,
  };
}

export function redfilmBackdropFallback() {
  return REDFILM_BACKDROP_FALLBACK;
}

export type WatchArtwork = Awaited<ReturnType<typeof getWatchArtwork>>;
