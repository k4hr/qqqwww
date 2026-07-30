import { MovieArtworkType, Prisma, type Movie } from "@prisma/client";
import {
  artworkAspectRatio,
  isUsefulArtworkUrl,
  isValidLogoArtwork,
  isValidPosterArtwork,
  isWideBackdropArtwork,
} from "@/lib/artwork-validation";
import { prisma } from "@/lib/prisma";
import { probeRemoteImageDimensions } from "@/lib/remote-image-metadata";
import { getVibixVideoByImdbIdResult, getVibixVideoByKpIdResult, type VibixVideo } from "@/lib/vibix";

const REDFILM_BACKDROP_FALLBACK = "/redfilm-cinematic-bg.webp";
const ARTWORK_STALE_DAYS = 30;
const ARTWORK_SYNC_KEY = "default";
const VIBIX_DETAIL_SOURCE = "VIBIX_DETAIL";
const APPROVED_PUBLIC_SOURCES = new Set(["MANUAL", VIBIX_DETAIL_SOURCE, "VIBIX", "LEGACY_VALIDATED"]);
const WATCH_ARTWORK_RETRY_MS = 30 * 60_000;
const WATCH_ARTWORK_TIMEOUT_MS = 7_500;
let artworkBatchRunning = false;
const watchArtworkSyncPromises = new Map<string, Promise<ArtworkSyncResult>>();
const watchArtworkAttemptedAt = new Map<string, number>();

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
  isPrimary?: boolean | null;
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

function normalizedSource(source: string | null | undefined) {
  return source?.trim().toLocaleUpperCase("en-US") ?? "";
}

function isApprovedPublicSource(source: string | null | undefined) {
  return APPROVED_PUBLIC_SOURCES.has(normalizedSource(source));
}

function sourcePriority(source: string) {
  const normalized = normalizedSource(source);
  if (normalized === "MANUAL") return 1_000;
  if (normalized === VIBIX_DETAIL_SOURCE) return 950;
  if (normalized === "VIBIX") return 720;
  if (normalized === "LEGACY_VALIDATED") return 620;
  return 0;
}

function scoreArtwork(input: ArtworkInput) {
  const pixels = (input.width ?? 0) * (input.height ?? 0);
  const primaryBonus = input.isPrimary ? 40 : 0;
  return sourcePriority(input.source) + pixels / 60_000 + primaryBonus - (input.sortOrder ?? 0);
}

type PublicBackdropArtwork = ArtworkInput & { isPrimary?: boolean | null };

export function selectPublicBackdrop<T extends PublicBackdropArtwork>(artworks: T[]): T | null {
  return artworks
    .filter((artwork) => artwork.type === MovieArtworkType.BACKDROP)
    .filter((artwork) => isApprovedPublicSource(artwork.source))
    .filter(isWideBackdropArtwork)
    .sort((a, b) => scoreArtwork(b) - scoreArtwork(a))[0] ?? null;
}

async function loadPublicBackdropRows(ids: string[]) {
  return prisma.movieArtwork.findMany({
    where: {
      movieId: { in: ids },
      type: MovieArtworkType.BACKDROP,
      source: { in: Array.from(APPROVED_PUBLIC_SOURCES) },
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { width: "desc" }],
  });
}

type PublicBackdropMapOptions = {
  enrichMissing?: boolean;
  maxEnrich?: number;
};

async function enrichMissingVibixBackdrops(movieIds: string[], maxEnrich: number) {
  if (!process.env.VIBIX_API_KEY?.trim() || maxEnrich <= 0) return 0;
  const targets = movieIds.slice(0, Math.max(0, Math.min(maxEnrich, 12)));
  let completed = 0;
  let index = 0;
  const concurrency = Math.min(2, targets.length);

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < targets.length) {
      const movieId = targets[index++];
      const result = await syncMovieArtwork(movieId);
      if (result.ok && result.primaryBackdropUrl) completed += 1;
      await sleep(450);
    }
  }));

  return completed;
}

export async function getPublicBackdropMap(movieIds: string[], options: PublicBackdropMapOptions = {}) {
  const ids = Array.from(new Set(movieIds.filter(Boolean))).slice(0, 500);
  if (!ids.length) return new Map<string, string>();

  let rows = await loadPublicBackdropRows(ids);
  let grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.movieId, [...(grouped.get(row.movieId) ?? []), row]);

  const missing = ids.filter((id) => !selectPublicBackdrop(grouped.get(id) ?? []));
  if (options.enrichMissing && missing.length) {
    const enriched = await enrichMissingVibixBackdrops(missing, options.maxEnrich ?? 6);
    if (enriched) {
      rows = await loadPublicBackdropRows(ids);
      grouped = new Map<string, typeof rows>();
      for (const row of rows) grouped.set(row.movieId, [...(grouped.get(row.movieId) ?? []), row]);
    }
  }

  const validated = new Map<string, string>();
  for (const id of ids) {
    const backdrop = selectPublicBackdrop(grouped.get(id) ?? []);
    if (backdrop) validated.set(id, backdrop.url);
  }
  return validated;
}

export async function getPublicBackdrop(movieId: string) {
  return (await getPublicBackdropMap([movieId], { enrichMissing: true, maxEnrich: 1 })).get(movieId) ?? REDFILM_BACKDROP_FALLBACK;
}

export async function getPublicBackdropDiagnostics() {
  const [row] = await prisma.$queryRaw<Array<{
    valid: bigint;
    missing: bigint;
    oldVibix: bigint;
    legacy: bigint;
  }>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "MovieArtwork" a
        WHERE a."movieId" = m."id"
          AND a."type" = 'BACKDROP'
          AND a."source" IN ('MANUAL', 'VIBIX_DETAIL', 'VIBIX', 'LEGACY_VALIDATED')
          AND COALESCE(a."aspectRatio", CASE WHEN a."height" > 0 THEN a."width"::double precision / a."height" ELSE NULL END) BETWEEN 1.5 AND 2.55
          AND (a."width" IS NULL OR a."width" >= 780)
          AND (a."height" IS NULL OR a."height" >= 360)
      )) AS "valid",
      COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM "MovieArtwork" a
        WHERE a."movieId" = m."id"
          AND a."type" = 'BACKDROP'
          AND a."source" IN ('MANUAL', 'VIBIX_DETAIL', 'VIBIX', 'LEGACY_VALIDATED')
          AND COALESCE(a."aspectRatio", CASE WHEN a."height" > 0 THEN a."width"::double precision / a."height" ELSE NULL END) BETWEEN 1.5 AND 2.55
          AND (a."width" IS NULL OR a."width" >= 780)
          AND (a."height" IS NULL OR a."height" >= 360)
      )) AS "missing",
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "MovieArtwork" a
        WHERE a."movieId" = m."id" AND a."type" = 'BACKDROP' AND UPPER(a."source") = 'VIBIX'
      )) AS "oldVibix",
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "MovieArtwork" a
        WHERE a."movieId" = m."id" AND a."type" = 'BACKDROP' AND UPPER(a."source") LIKE 'LEGACY%'
      )) AS "legacy"
    FROM "Movie" m
    WHERE m."isPublished" = true
  `);
  return {
    valid: Number(row?.valid ?? 0),
    invalid: 0,
    unknown: Number(row?.oldVibix ?? 0) + Number(row?.legacy ?? 0),
    fallback: Number(row?.missing ?? 0),
    vibixDetail: Number(row?.valid ?? 0),
    oldVibix: Number(row?.oldVibix ?? 0),
    legacy: Number(row?.legacy ?? 0),
  };
}

function normalizeArtworkIdentity(url?: string | null) {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    parsed.search = "";
    return decodeURIComponent(parsed.toString()).toLocaleLowerCase("en-US");
  } catch {
    return raw.split(/[?#]/, 1)[0].toLocaleLowerCase("en-US");
  }
}

function sameArtworkUrl(left?: string | null, right?: string | null) {
  const a = normalizeArtworkIdentity(left);
  const b = normalizeArtworkIdentity(right);
  return Boolean(a && b && a === b);
}

async function remoteArtwork(type: MovieArtworkType, source: string, url?: string | null): Promise<ArtworkInput | null> {
  const normalized = url?.trim();
  if (!normalized || !isUsefulArtworkUrl(normalized)) return null;
  const dimensions = await probeRemoteImageDimensions(normalized);
  if (!dimensions) return null;
  const artwork: ArtworkInput = {
    type,
    source,
    url: normalized,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.aspectRatio,
  };
  if (type === MovieArtworkType.BACKDROP && !isWideBackdropArtwork(artwork)) return null;
  if (type === MovieArtworkType.POSTER && !isValidPosterArtwork(artwork)) return null;
  return artwork;
}

function mergeVibixDetails(base: VibixVideo | null, incoming: VibixVideo | null) {
  if (!base) return incoming;
  if (!incoming) return base;
  const merged = { ...base } as VibixVideo;
  for (const [key, value] of Object.entries(incoming) as Array<[keyof VibixVideo, VibixVideo[keyof VibixVideo]]>) {
    if (value !== null && value !== undefined && value !== "") (merged as Record<string, unknown>)[String(key)] = value;
  }
  return merged;
}

type VibixArtworkLookup = {
  details: VibixVideo | null;
  rateLimited: boolean;
  requestFailed: boolean;
  route: "kp" | "imdb" | "kp+imdb" | null;
};

async function getVibixArtworkDetails(movie: Pick<Movie, "kinopoiskId" | "imdbId">): Promise<VibixArtworkLookup> {
  let details: VibixVideo | null = null;
  let rateLimited = false;
  let requestFailed = false;
  let usedKp = false;
  let usedImdb = false;

  if (movie.kinopoiskId?.trim()) {
    const result = await getVibixVideoByKpIdResult(movie.kinopoiskId.trim());
    rateLimited ||= result.rateLimited;
    requestFailed ||= result.requestFailed;
    if (result.video) {
      details = mergeVibixDetails(details, result.video);
      usedKp = true;
    }
  }

  if ((!details?.backdrop_url || !details?.poster_url) && movie.imdbId?.trim() && !rateLimited) {
    const result = await getVibixVideoByImdbIdResult(movie.imdbId.trim());
    rateLimited ||= result.rateLimited;
    requestFailed ||= result.requestFailed;
    if (result.video) {
      details = mergeVibixDetails(details, result.video);
      usedImdb = true;
    }
  }

  const route = usedKp && usedImdb ? "kp+imdb" : usedKp ? "kp" : usedImdb ? "imdb" : null;
  return { details, rateLimited, requestFailed, route };
}

async function buildVibixDetailArtwork(details: VibixVideo) {
  const posterUrl = details.poster_url?.trim() || null;
  const backdropUrl = details.backdrop_url?.trim() || null;
  const safeBackdropUrl = sameArtworkUrl(backdropUrl, posterUrl) ? null : backdropUrl;

  const [backdrop, poster] = await Promise.all([
    remoteArtwork(MovieArtworkType.BACKDROP, VIBIX_DETAIL_SOURCE, safeBackdropUrl),
    remoteArtwork(MovieArtworkType.POSTER, VIBIX_DETAIL_SOURCE, posterUrl),
  ]);

  return [backdrop, poster].filter((item): item is ArtworkInput => Boolean(item));
}

async function reconcileSourceArtwork(movieId: string, source: string, artworks: ArtworkInput[]) {
  const managedTypes = [MovieArtworkType.BACKDROP, MovieArtworkType.POSTER];
  const incomingByType = new Map<MovieArtworkType, ArtworkInput[]>();
  for (const type of managedTypes) incomingByType.set(type, artworks.filter((item) => item.type === type));

  const existing = await prisma.movieArtwork.findMany({
    where: { movieId, source: { equals: source, mode: "insensitive" }, type: { in: managedTypes } },
    select: { id: true, type: true, url: true },
  });
  const existingKeys = new Set(existing.map((item) => `${item.type}:${item.url}`));
  let imported = 0;
  let updated = 0;
  let deleted = 0;

  await prisma.$transaction(async (tx) => {
    for (const type of managedTypes) {
      const typeArtworks = incomingByType.get(type) ?? [];
      const freshUrls = new Set(typeArtworks.map((artwork) => artwork.url));

      for (const [index, artwork] of typeArtworks.entries()) {
        if (existingKeys.has(`${artwork.type}:${artwork.url}`)) updated += 1;
        else imported += 1;
        await tx.movieArtwork.upsert({
          where: { movieId_type_url: { movieId, type: artwork.type, url: artwork.url } },
          create: {
            movieId,
            type: artwork.type,
            source,
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
            source,
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

      const staleIds = existing
        .filter((item) => item.type === type && !freshUrls.has(item.url))
        .map((item) => item.id);
      if (staleIds.length) {
        const removed = await tx.movieArtwork.deleteMany({ where: { id: { in: staleIds } } });
        deleted += removed.count;
      }
    }

    await tx.movie.update({ where: { id: movieId }, data: { lastExternalEnrichmentAt: new Date() } });
  });

  return { imported, updated, deleted };
}

async function setPrimaryBackdrop(movie: Pick<Movie, "id" | "backdropUrl">) {
  const allBackdrops = await prisma.movieArtwork.findMany({
    where: { movieId: movie.id, type: MovieArtworkType.BACKDROP },
  });
  const winner = selectPublicBackdrop(allBackdrops) as (typeof allBackdrops)[number] | null;

  await prisma.$transaction(async (tx) => {
    await tx.movieArtwork.updateMany({
      where: { movieId: movie.id, type: MovieArtworkType.BACKDROP },
      data: { isPrimary: false },
    });
    if (winner) {
      await tx.movieArtwork.update({ where: { id: winner.id }, data: { isPrimary: true } });
      if (movie.backdropUrl !== winner.url) {
        await tx.movie.update({ where: { id: movie.id }, data: { backdropUrl: winner.url } });
      }
    } else if (movie.backdropUrl) {
      await tx.movie.update({ where: { id: movie.id }, data: { backdropUrl: null } });
    }
  });

  return winner?.url ?? null;
}

export async function syncVibixArtworkUrls(movieId: string, video: Pick<VibixVideo, "poster_url" | "backdrop_url">) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true, backdropUrl: true } });
  if (!movie) return { imported: 0, updated: 0, deleted: 0, primaryBackdropUrl: null };

  const artworks = await buildVibixDetailArtwork(video as VibixVideo);
  const result = await reconcileSourceArtwork(movieId, VIBIX_DETAIL_SOURCE, artworks);
  const primaryBackdropUrl = await setPrimaryBackdrop(movie);
  return { ...result, primaryBackdropUrl };
}

type ArtworkSyncOptions = { providers?: "vibix" | "all" };

export async function syncMovieArtwork(movieId: string, _options: ArtworkSyncOptions = {}): Promise<ArtworkSyncResult> {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: {
      id: true,
      imdbId: true,
      kinopoiskId: true,
      backdropUrl: true,
    },
  });
  if (!movie) return { ok: false, imported: 0, updated: 0, deleted: 0, skipped: 1, error: "Movie not found" };
  if (!process.env.VIBIX_API_KEY?.trim()) {
    return { ok: true, disabled: true, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, primaryBackdropUrl: null };
  }
  if (!movie.kinopoiskId?.trim() && !movie.imdbId?.trim()) {
    return { ok: true, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, primaryBackdropUrl: await setPrimaryBackdrop(movie) };
  }

  try {
    const lookup = await getVibixArtworkDetails(movie);
    if (lookup.rateLimited) {
      return { ok: false, movieId, imported: 0, updated: 0, deleted: 0, skipped: 1, error: "Vibix API rate limit" };
    }
    if (!lookup.details) {
      const primaryBackdropUrl = await setPrimaryBackdrop(movie);
      return {
        ok: !lookup.requestFailed,
        movieId,
        imported: 0,
        updated: 0,
        deleted: 0,
        skipped: 1,
        primaryBackdropUrl,
        error: lookup.requestFailed ? "Vibix detail request failed" : undefined,
      };
    }

    const artworks = await buildVibixDetailArtwork(lookup.details);
    const result = await reconcileSourceArtwork(movie.id, VIBIX_DETAIL_SOURCE, artworks);
    const primaryBackdropUrl = await setPrimaryBackdrop(movie);
    return {
      ok: true,
      movieId,
      ...result,
      skipped: artworks.length ? 0 : 1,
      primaryBackdropUrl,
    };
  } catch (error) {
    return {
      ok: false,
      movieId,
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 1,
      error: error instanceof Error ? error.message : "Unknown artwork sync error",
    };
  }
}

type ArtworkBatchOptions = { limit?: number; concurrency?: number; cursor?: string };

export type ArtworkBatchResult = {
  ok: boolean;
  disabled: boolean;
  processed: number;
  imported: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
  nextCursor?: string;
  movieIds: string[];
  errors?: string[];
  message?: string;
};

type ArtworkBatchPhase = 1 | 2 | 3 | 4;

function parseArtworkCursor(cursor?: string): { phase: ArtworkBatchPhase; id: string } {
  const match = cursor?.match(/^([1-4]):(.*)$/);
  if (match) return { phase: Number(match[1]) as ArtworkBatchPhase, id: match[2] };
  return { phase: 1, id: cursor?.trim() ?? "" };
}

function artworkPhaseWhere(phase: ArtworkBatchPhase, staleBefore: Date): Prisma.MovieWhereInput {
  const noFreshVibixDetailBackdrop: Prisma.MovieWhereInput = {
    artworks: { none: { type: MovieArtworkType.BACKDROP, source: VIBIX_DETAIL_SOURCE } },
  };

  if (phase === 1) {
    return {
      AND: [
        { OR: [{ isHeroEligible: true }, { isHomeEligible: true }, { isTrendingEligible: true }] },
        noFreshVibixDetailBackdrop,
      ],
    };
  }
  if (phase === 2) return noFreshVibixDetailBackdrop;
  if (phase === 3) {
    return {
      artworks: {
        some: {
          type: MovieArtworkType.BACKDROP,
          source: VIBIX_DETAIL_SOURCE,
          updatedAt: { lt: staleBefore },
        },
      },
    };
  }
  return {
    artworks: {
      some: {
        type: MovieArtworkType.BACKDROP,
        source: { in: ["VIBIX", "LEGACY", "LEGACY_VALIDATED", "TMDB"] },
      },
    },
  };
}

async function selectArtworkBatch(limit: number, cursor?: string) {
  const selected: Array<{ id: string }> = [];
  const selectedIds = new Set<string>();
  const staleBefore = new Date(Date.now() - ARTWORK_STALE_DAYS * 86_400_000);
  let { phase, id } = parseArtworkCursor(cursor);
  let nextCursor: string | undefined;

  while (selected.length < limit && phase <= 4) {
    const remaining = limit - selected.length;
    const rows = await prisma.movie.findMany({
      where: {
        AND: [
          {
            isPublished: true,
            id: id ? { gt: id } : undefined,
            OR: [{ imdbId: { not: null } }, { kinopoiskId: { not: null } }],
          },
          artworkPhaseWhere(phase, staleBefore),
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: remaining,
    });

    for (const row of rows) {
      if (!selectedIds.has(row.id)) {
        selectedIds.add(row.id);
        selected.push(row);
      }
    }
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

export async function syncMovieArtworkBatch({ limit = 25, concurrency = 2, cursor }: ArtworkBatchOptions = {}): Promise<ArtworkBatchResult> {
  if (!process.env.VIBIX_API_KEY?.trim()) {
    return {
      ok: true,
      disabled: true,
      processed: 0,
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      nextCursor: cursor,
      movieIds: [],
      message: "VIBIX_API_KEY не указан. Vibix artwork enrichment отключён.",
    };
  }

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const selection = await selectArtworkBatch(safeLimit, cursor);
  const movies = selection.movies;
  const result = {
    ok: true,
    disabled: false,
    processed: 0,
    imported: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    nextCursor: selection.nextCursor,
    movieIds: movies.map((movie) => movie.id),
    errors: [] as string[],
  };
  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, 2));

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
      await sleep(700);
    }
  }));

  result.ok = result.failed === 0;
  return result;
}

export async function getArtworkSyncState() {
  return prisma.movieArtworkSyncState.upsert({
    where: { singletonKey: ARTWORK_SYNC_KEY },
    create: { singletonKey: ARTWORK_SYNC_KEY },
    update: {},
  });
}

function cursorPhase(cursor?: string | null) {
  return cursor?.match(/^([1-4]):/)?.[1] ?? "1";
}

async function executeArtworkStateBatch() {
  if (artworkBatchRunning) {
    return { ok: false, message: "Artwork batch уже выполняется в этом server process.", state: await getArtworkSyncState(), result: null };
  }
  artworkBatchRunning = true;
  const state = await getArtworkSyncState();
  const safeCursor = state.cursor;
  try {
    const result = await syncMovieArtworkBatch({
      limit: state.batchSize,
      concurrency: state.concurrency,
      cursor: safeCursor ?? undefined,
    });
    if (result.disabled) {
      const next = await prisma.movieArtworkSyncState.update({
        where: { singletonKey: ARTWORK_SYNC_KEY },
        data: { status: "PAUSED", lastError: result.message ?? "Vibix artwork provider не настроен." },
      });
      return { ok: true, message: result.message, state: next, result };
    }

    const failed = result.failed > 0;
    const completed = !failed && !result.nextCursor;
    const next = await prisma.movieArtworkSyncState.update({
      where: { singletonKey: ARTWORK_SYNC_KEY },
      data: {
        status: failed ? "FAILED" : completed ? "COMPLETED" : "RUNNING",
        phase: completed ? "DONE" : cursorPhase(failed ? safeCursor : result.nextCursor),
        cursor: failed ? safeCursor : result.nextCursor ?? null,
        processed: { increment: result.processed },
        imported: { increment: result.imported },
        updated: { increment: result.updated },
        deleted: { increment: result.deleted },
        skipped: { increment: result.skipped },
        failed: { increment: result.failed },
        lastError: failed ? result.errors?.join("\n").slice(0, 8_000) || "Artwork batch completed with errors." : null,
        completedAt: completed ? new Date() : null,
      },
    });
    return {
      ok: !failed,
      message: completed
        ? "Vibix artwork sync завершён."
        : failed
          ? "Batch завершился с ошибками и сохранён на последнем безопасном cursor."
          : "Batch завершён, cursor сохранён.",
      state: next,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown artwork batch error";
    const next = await prisma.movieArtworkSyncState.update({
      where: { singletonKey: ARTWORK_SYNC_KEY },
      data: { status: "FAILED", cursor: safeCursor, phase: cursorPhase(safeCursor), lastError: message.slice(0, 8_000) },
    });
    return { ok: false, message, state: next, result: null };
  } finally {
    artworkBatchRunning = false;
  }
}

export async function startArtworkSyncState(options: { limit?: number; concurrency?: number } = {}) {
  const batchSize = Math.max(1, Math.min(options.limit ?? 25, 100));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 2));
  await prisma.movieArtworkSyncState.upsert({
    where: { singletonKey: ARTWORK_SYNC_KEY },
    create: { singletonKey: ARTWORK_SYNC_KEY, status: "RUNNING", batchSize, concurrency, startedAt: new Date() },
    update: {
      status: "RUNNING",
      phase: "1",
      cursor: null,
      processed: 0,
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      batchSize,
      concurrency,
      lastError: null,
      startedAt: new Date(),
      completedAt: null,
    },
  });
  return executeArtworkStateBatch();
}

export async function continueArtworkSyncState() {
  const state = await getArtworkSyncState();
  if (state.status === "COMPLETED") {
    return { ok: false, message: "Синхронизация завершена. Для полного refresh используйте «Начать заново».", state, result: null };
  }
  await prisma.movieArtworkSyncState.update({
    where: { singletonKey: ARTWORK_SYNC_KEY },
    data: { status: "RUNNING", lastError: null, completedAt: null, startedAt: state.startedAt ?? new Date() },
  });
  return executeArtworkStateBatch();
}

export async function pauseArtworkSyncState() {
  return prisma.movieArtworkSyncState.upsert({
    where: { singletonKey: ARTWORK_SYNC_KEY },
    create: { singletonKey: ARTWORK_SYNC_KEY, status: "PAUSED" },
    update: { status: "PAUSED" },
  });
}

export async function resetArtworkSyncState() {
  return prisma.movieArtworkSyncState.upsert({
    where: { singletonKey: ARTWORK_SYNC_KEY },
    create: { singletonKey: ARTWORK_SYNC_KEY },
    update: {
      status: "IDLE",
      phase: "1",
      cursor: null,
      processed: 0,
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
    },
  });
}

async function loadWatchArtwork(movieId: string) {
  const [artworks, movie] = await Promise.all([
    prisma.movieArtwork.findMany({
      where: {
        movieId,
        OR: [
          { type: MovieArtworkType.BACKDROP, source: { in: Array.from(APPROVED_PUBLIC_SOURCES) } },
          { type: MovieArtworkType.POSTER, source: VIBIX_DETAIL_SOURCE },
        ],
      },
      orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { sortOrder: "asc" }],
      take: 16,
    }),
    prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        posterUrl: true,
        editorialPosterUrl: true,
        editorialBackdropUrl: true,
        lastExternalEnrichmentAt: true,
        kinopoiskId: true,
        imdbId: true,
      },
    }),
  ]);
  const primary = selectPublicBackdrop(artworks);
  const vibixDetailBackdrop = artworks.find((item) => item.type === MovieArtworkType.BACKDROP && normalizedSource(item.source) === VIBIX_DETAIL_SOURCE && isWideBackdropArtwork(item)) ?? null;
  return {
    primary,
    vibixDetailBackdrop,
    posterUrl: movie?.editorialPosterUrl ?? movie?.posterUrl ?? null,
    editorialBackdropUrl: movie?.editorialBackdropUrl ?? null,
    lastExternalEnrichmentAt: movie?.lastExternalEnrichmentAt ?? null,
    hasLookupId: Boolean(movie?.kinopoiskId?.trim() || movie?.imdbId?.trim()),
  };
}

async function enrichWatchArtwork(movieId: string) {
  const lastAttempt = watchArtworkAttemptedAt.get(movieId) ?? 0;
  if (Date.now() - lastAttempt < WATCH_ARTWORK_RETRY_MS) return null;
  watchArtworkAttemptedAt.set(movieId, Date.now());

  let pending = watchArtworkSyncPromises.get(movieId);
  if (!pending) {
    pending = syncMovieArtwork(movieId).finally(() => watchArtworkSyncPromises.delete(movieId));
    watchArtworkSyncPromises.set(movieId, pending);
  }
  return Promise.race([pending, sleep(WATCH_ARTWORK_TIMEOUT_MS).then(() => null)]);
}

function isStale(date: Date | null) {
  if (!date) return true;
  return date.getTime() < Date.now() - ARTWORK_STALE_DAYS * 86_400_000;
}

export async function getWatchArtwork(movieId: string, _fallbackBackdropUrl?: string | null) {
  let loaded = await loadWatchArtwork(movieId);
  const shouldRefreshFromVibix = Boolean(
    process.env.VIBIX_API_KEY?.trim()
      && loaded.hasLookupId
      && (!loaded.vibixDetailBackdrop || isStale(loaded.lastExternalEnrichmentAt)),
  );

  if (shouldRefreshFromVibix) {
    await enrichWatchArtwork(movieId);
    loaded = await loadWatchArtwork(movieId);
  }

  return {
    backdropUrl: loaded.editorialBackdropUrl ?? loaded.primary?.url ?? REDFILM_BACKDROP_FALLBACK,
    posterUrl: loaded.posterUrl,
    backdropSource: loaded.editorialBackdropUrl ? "EDITORIAL" : (loaded.primary?.source ?? "REDFILM_FALLBACK"),
    artworks: [],
  };
}

export function redfilmBackdropFallback() {
  return REDFILM_BACKDROP_FALLBACK;
}

export { artworkAspectRatio, isUsefulArtworkUrl, isValidLogoArtwork, isValidPosterArtwork, isWideBackdropArtwork };

export type WatchArtwork = Awaited<ReturnType<typeof getWatchArtwork>>;
