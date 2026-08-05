import "server-only";

import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findTmdbByImdbId, getTmdbDetails, resolveTmdbSummary } from "@/lib/tmdb";
import { getVibixVideoByVibixIdResult, sleep } from "@/lib/vibix";

const SINGLETON_KEY = "default";
const DEFAULT_BATCH_SIZE = envInt("MOVIE_DURATION_BACKFILL_BATCH_SIZE", 10, 1, 50);
const REQUEST_DELAY_MS = envInt("MOVIE_DURATION_BACKFILL_REQUEST_DELAY_MS", 750, 0, 15_000);
const AUTO_ENABLED = process.env.MOVIE_DURATION_BACKFILL_AUTO_ENABLED !== "false";
const MAX_DURATION_MINUTES = 600;

const durationBackfillGlobal = globalThis as typeof globalThis & {
  __redfilmDurationBackfillRunning?: boolean;
};

type BackfillMovie = {
  id: string;
  titleRu: string;
  titleOriginal: string | null;
  year: number;
  type: ContentType;
  imdbId: string | null;
  tmdbId: string | null;
  vibixId: number | null;
  vibixType: string | null;
  vibixSeasonCount: number | null;
  vibixEpisodeCount: number | null;
};

type DurationResolution = {
  duration: number;
  source: "VIBIX" | "TMDB";
  tmdbId?: string | null;
};

class BackfillRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "BackfillRateLimitError";
  }
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeDuration(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > MAX_DURATION_MINUTES) return null;
  return rounded;
}

function missingDurationWhere(): Prisma.MovieWhereInput {
  return {
    isPublished: true,
    isCatalogAllowed: true,
    vibixAvailable: true,
    OR: [{ duration: null }, { duration: { lte: 0 } }],
  };
}

function preferredTmdbType(movie: BackfillMovie) {
  if (movie.type === ContentType.SERIES) return ContentType.SERIES;
  if (movie.type === ContentType.MOVIE) return ContentType.MOVIE;

  const vibixType = (movie.vibixType ?? "").toLowerCase();
  const serialMarker = ["serial", "series", "tv", "show"].some((marker) => vibixType.includes(marker));
  return serialMarker || (movie.vibixSeasonCount ?? 0) > 0 || (movie.vibixEpisodeCount ?? 0) > 0
    ? ContentType.SERIES
    : ContentType.MOVIE;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function retryAfterFromError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: unknown; retryAfter?: unknown };
  if (Number(record.status) !== 429) return null;
  const header = String(record.retryAfter ?? "").trim();
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(30_000, date - Date.now());
  return 5 * 60_000;
}

async function ensureState() {
  return prisma.movieDurationBackfillState.upsert({
    where: { singletonKey: SINGLETON_KEY },
    create: { singletonKey: SINGLETON_KEY, batchSize: DEFAULT_BATCH_SIZE },
    update: {},
  });
}

async function remainingCount() {
  return prisma.movie.count({ where: missingDurationWhere() });
}

export async function getMovieDurationBackfillState() {
  const [state, remaining] = await Promise.all([ensureState(), remainingCount()]);
  return {
    singletonKey: state.singletonKey,
    status: state.status,
    cursor: state.cursor,
    processed: state.processed,
    updated: state.updated,
    vibixUpdated: state.vibixUpdated,
    tmdbUpdated: state.tmdbUpdated,
    skipped: state.skipped,
    failed: state.failed,
    batchSize: state.batchSize,
    remainingAtCompletion: state.remainingAtCompletion,
    remaining,
    rateLimitUntil: state.rateLimitUntil?.toISOString() ?? null,
    lastError: state.lastError,
    startedAt: state.startedAt?.toISOString() ?? null,
    completedAt: state.completedAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
    active: ["QUEUED", "RUNNING"].includes(state.status)
      || (state.status === "PAUSED" && Boolean(state.rateLimitUntil)),
  };
}

export async function startMovieDurationBackfill(batchSize = DEFAULT_BATCH_SIZE) {
  const current = await ensureState();
  const normalizedBatchSize = Math.max(1, Math.min(50, Math.trunc(batchSize || DEFAULT_BATCH_SIZE)));
  const continueExisting = current.status === "PAUSED" && !current.completedAt;

  await prisma.movieDurationBackfillState.update({
    where: { singletonKey: SINGLETON_KEY },
    data: continueExisting
      ? {
          status: "QUEUED",
          batchSize: normalizedBatchSize,
          rateLimitUntil: null,
          lastError: null,
        }
      : {
          status: "QUEUED",
          cursor: null,
          processed: 0,
          updated: 0,
          vibixUpdated: 0,
          tmdbUpdated: 0,
          skipped: 0,
          failed: 0,
          batchSize: normalizedBatchSize,
          remainingAtCompletion: 0,
          rateLimitUntil: null,
          lastError: null,
          startedAt: new Date(),
          completedAt: null,
        },
  });

  return getMovieDurationBackfillState();
}

export async function pauseMovieDurationBackfill() {
  await ensureState();
  await prisma.movieDurationBackfillState.update({
    where: { singletonKey: SINGLETON_KEY },
    data: { status: "PAUSED", rateLimitUntil: null },
  });
  return getMovieDurationBackfillState();
}

export async function resetMovieDurationBackfill() {
  await ensureState();
  await prisma.movieDurationBackfillState.update({
    where: { singletonKey: SINGLETON_KEY },
    data: {
      status: "IDLE",
      cursor: null,
      processed: 0,
      updated: 0,
      vibixUpdated: 0,
      tmdbUpdated: 0,
      skipped: 0,
      failed: 0,
      remainingAtCompletion: 0,
      rateLimitUntil: null,
      lastError: null,
      startedAt: null,
      completedAt: null,
    },
  });
  return getMovieDurationBackfillState();
}

async function resolveFromVibix(movie: BackfillMovie): Promise<DurationResolution | null> {
  if (movie.vibixId === null) return null;

  const result = await getVibixVideoByVibixIdResult(movie.vibixId, {
    type: preferredTmdbType(movie) === ContentType.SERIES ? "serial" : "movie",
  });

  if (result.rateLimited) {
    throw new BackfillRateLimitError(
      `Vibix rate limit для ${movie.titleRu}`,
      Math.max(30_000, result.retryAfterMs ?? 5 * 60_000),
    );
  }

  if (result.requestFailed) {
    const status = result.error?.status;
    if (status === 429) {
      throw new BackfillRateLimitError(
        `Vibix HTTP 429 для ${movie.titleRu}`,
        Math.max(30_000, result.retryAfterMs ?? 5 * 60_000),
      );
    }
    return null;
  }

  const duration = normalizeDuration(result.video?.duration);
  return duration ? { duration, source: "VIBIX" } : null;
}

async function resolveFromTmdb(movie: BackfillMovie): Promise<DurationResolution | null> {
  if (!process.env.TMDB_API_KEY?.trim()) return null;

  const preferredType = preferredTmdbType(movie);
  let summary = movie.imdbId
    ? await findTmdbByImdbId(movie.imdbId, preferredType)
    : null;

  if (!summary) {
    summary = await resolveTmdbSummary({
      type: preferredType,
      imdbId: movie.imdbId,
      titleRu: movie.titleRu,
      titleOriginal: movie.titleOriginal,
      year: movie.year,
    });
  }

  if (!summary?.id) return null;
  const detailType = summary.media_type
    ? summary.media_type === "tv" ? ContentType.SERIES : ContentType.MOVIE
    : preferredType;
  const details = await getTmdbDetails(String(summary.id), detailType);
  const duration = normalizeDuration(details.duration);
  return duration
    ? { duration, source: "TMDB", tmdbId: String(summary.id) }
    : null;
}

async function resolveMovieDuration(movie: BackfillMovie): Promise<DurationResolution | null> {
  const vibix = await resolveFromVibix(movie);
  if (vibix) return vibix;

  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);

  try {
    return await resolveFromTmdb(movie);
  } catch (error) {
    const retryAfterMs = retryAfterFromError(error);
    if (retryAfterMs) {
      throw new BackfillRateLimitError(`TMDB rate limit для ${movie.titleRu}`, retryAfterMs);
    }
    throw error;
  }
}

async function markCompleted(lastError: string | null = null) {
  const remaining = await remainingCount();
  await prisma.movieDurationBackfillState.update({
    where: { singletonKey: SINGLETON_KEY },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      remainingAtCompletion: remaining,
      rateLimitUntil: null,
      lastError,
    },
  });
  return getMovieDurationBackfillState();
}

export async function runMovieDurationBackfillIteration(options: { force?: boolean } = {}) {
  if (durationBackfillGlobal.__redfilmDurationBackfillRunning) {
    return getMovieDurationBackfillState();
  }

  durationBackfillGlobal.__redfilmDurationBackfillRunning = true;

  try {
    let state = await ensureState();

    if (state.status === "PAUSED" && state.rateLimitUntil && state.rateLimitUntil.getTime() <= Date.now()) {
      state = await prisma.movieDurationBackfillState.update({
        where: { singletonKey: SINGLETON_KEY },
        data: { status: "QUEUED", rateLimitUntil: null, lastError: null },
      });
    }

    if (!options.force && !["QUEUED", "RUNNING"].includes(state.status)) {
      return getMovieDurationBackfillState();
    }

    if (options.force && !["QUEUED", "RUNNING"].includes(state.status)) {
      await startMovieDurationBackfill(state.batchSize);
      state = await ensureState();
    }

    state = await prisma.movieDurationBackfillState.update({
      where: { singletonKey: SINGLETON_KEY },
      data: {
        status: "RUNNING",
        startedAt: state.startedAt ?? new Date(),
        completedAt: null,
        rateLimitUntil: null,
      },
    });

    const movies = await prisma.movie.findMany({
      where: {
        ...missingDurationWhere(),
        ...(state.cursor ? { id: { gt: state.cursor } } : {}),
      },
      select: {
        id: true,
        titleRu: true,
        titleOriginal: true,
        year: true,
        type: true,
        imdbId: true,
        tmdbId: true,
        vibixId: true,
        vibixType: true,
        vibixSeasonCount: true,
        vibixEpisodeCount: true,
      },
      orderBy: { id: "asc" },
      take: state.batchSize,
    });

    if (!movies.length) {
      return markCompleted(state.failed || state.skipped
        ? "Проход завершён. Неразрешённые записи можно повторно обработать новым запуском."
        : null);
    }

    let processed = 0;
    let updated = 0;
    let vibixUpdated = 0;
    let tmdbUpdated = 0;
    let skipped = 0;
    let failed = 0;
    let cursor = state.cursor;
    let lastError: string | null = null;

    for (const movie of movies) {
      try {
        const resolved = await resolveMovieDuration(movie);
        processed += 1;
        cursor = movie.id;

        if (!resolved) {
          skipped += 1;
          lastError = `Длительность не найдена: ${movie.titleRu} (${movie.year})`;
        } else {
          const result = await prisma.movie.updateMany({
            where: {
              id: movie.id,
              OR: [{ duration: null }, { duration: { lte: 0 } }],
            },
            data: {
              duration: resolved.duration,
              durationSource: resolved.source,
              durationLastSyncAt: new Date(),
              tmdbId: resolved.tmdbId ?? undefined,
            },
          });

          if (result.count > 0) {
            updated += 1;
            if (resolved.source === "VIBIX") vibixUpdated += 1;
            if (resolved.source === "TMDB") tmdbUpdated += 1;
          }
        }
      } catch (error) {
        if (error instanceof BackfillRateLimitError) {
          const rateLimitUntil = new Date(Date.now() + error.retryAfterMs);
          await prisma.movieDurationBackfillState.update({
            where: { singletonKey: SINGLETON_KEY },
            data: {
              status: "PAUSED",
              cursor,
              processed: { increment: processed },
              updated: { increment: updated },
              vibixUpdated: { increment: vibixUpdated },
              tmdbUpdated: { increment: tmdbUpdated },
              skipped: { increment: skipped },
              failed: { increment: failed },
              rateLimitUntil,
              lastError: error.message,
            },
          });
          return getMovieDurationBackfillState();
        }

        processed += 1;
        failed += 1;
        cursor = movie.id;
        lastError = `${movie.titleRu}: ${errorText(error)}`.slice(0, 2_000);
      }

      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    }

    const latestState = await ensureState();
    const nextStatus = latestState.status === "PAUSED" && !latestState.rateLimitUntil
      ? "PAUSED"
      : "RUNNING";

    await prisma.movieDurationBackfillState.update({
      where: { singletonKey: SINGLETON_KEY },
      data: {
        status: nextStatus,
        cursor,
        processed: { increment: processed },
        updated: { increment: updated },
        vibixUpdated: { increment: vibixUpdated },
        tmdbUpdated: { increment: tmdbUpdated },
        skipped: { increment: skipped },
        failed: { increment: failed },
        lastError,
      },
    });

    if (movies.length < state.batchSize) return markCompleted(lastError);
    return getMovieDurationBackfillState();
  } finally {
    durationBackfillGlobal.__redfilmDurationBackfillRunning = false;
  }
}

export async function maybeRunMovieDurationBackfillMaintenance() {
  if (!AUTO_ENABLED) return null;

  const state = await ensureState();
  const remaining = await remainingCount();

  if (remaining <= 0) {
    if (state.status !== "COMPLETED" || state.remainingAtCompletion !== 0) {
      return markCompleted(null);
    }
    return getMovieDurationBackfillState();
  }

  if (state.status === "IDLE") {
    await startMovieDurationBackfill(state.batchSize || DEFAULT_BATCH_SIZE);
  } else if (state.status === "COMPLETED" && remaining > state.remainingAtCompletion) {
    await startMovieDurationBackfill(state.batchSize || DEFAULT_BATCH_SIZE);
  }

  return runMovieDurationBackfillIteration();
}
