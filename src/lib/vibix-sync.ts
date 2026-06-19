import { ContentType, type Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { getVibixVideoByImdbId, getVibixVideoByKpId, getVibixVideoLinks, sleep, type VibixVideo } from "@/lib/vibix";

export type VibixSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  pagesProcessed: number;
  totalFromVibix: number;
  startedAt: string;
  finishedAt: string;
  rateLimited: boolean;
  message: string | null;
};

type SyncOptions = {
  mode?: "quick" | "all";
  pages?: number;
  limit?: number;
  pageDelayMs?: number;
  maxPagesPerRun?: number;
};

const vibixSyncState = globalThis as typeof globalThis & { __redfilmVibixSyncRunning?: boolean };

export class VibixSyncAlreadyRunningError extends Error {
  constructor() {
    super("Vibix sync is already running");
    this.name = "VibixSyncAlreadyRunningError";
  }
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  const normalized = stringValue(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function contentType(value: unknown) {
  const normalized = stringValue(value)?.toLowerCase() ?? "";
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return ContentType.SERIES;
  if (["cartoon", "animation"].includes(normalized)) return ContentType.CARTOON;
  if (normalized === "anime") return ContentType.ANIME;
  return ContentType.MOVIE;
}

function videoData(video: VibixVideo) {
  const title = stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_eng);
  const year = intValue(video.year);
  const kinopoiskId = stringValue(video.kp_id);
  const imdbId = stringValue(video.imdb_id);
  const iframeUrl = stringValue(video.iframe_url);
  if (!title || !year || year < 1880 || year > 2200 || (!kinopoiskId && !imdbId) || !iframeUrl) return null;

  return {
    title,
    titleOriginal: stringValue(video.name_eng),
    year,
    kinopoiskId,
    imdbId,
    iframeUrl,
    posterUrl: stringValue(video.poster_url),
    quality: stringValue(video.quality) || "HD",
    type: contentType(video.type),
    vibixType: stringValue(video.type),
    vibixId: intValue(video.id),
    vibixUploadedAt: dateValue(video.uploaded_at),
  };
}

async function uniqueSlug(title: string, year: number) {
  const base = slugify(`${title}-${year}`) || `movie-${year}`;
  let slug = base;
  let index = 2;
  while (await prisma.movie.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

async function findExisting(kinopoiskId: string | null, imdbId: string | null) {
  const OR = [
    kinopoiskId ? { kinopoiskId } : null,
    imdbId ? { imdbId } : null,
  ].filter((item): item is { kinopoiskId: string } | { imdbId: string } => item !== null);
  return OR.length ? prisma.movie.findFirst({ where: { OR } }) : null;
}

async function saveVibixVideo(video: VibixVideo, targetMovieId?: string) {
  const data = videoData(video);
  if (!data) return "skipped" as const;
  const existing = targetMovieId
    ? await prisma.movie.findUnique({ where: { id: targetMovieId } })
    : await findExisting(data.kinopoiskId, data.imdbId);
  const syncedAt = new Date();

  if (existing) {
    await prisma.movie.update({
      where: { id: existing.id },
      data: {
        titleRu: data.title,
        titleOriginal: data.titleOriginal || undefined,
        year: data.year,
        type: data.type,
        posterUrl: data.posterUrl || undefined,
        quality: data.quality,
        kinopoiskId: data.kinopoiskId || undefined,
        imdbId: data.imdbId || undefined,
        vibixId: data.vibixId,
        vibixIframeUrl: data.iframeUrl,
        vibixAvailable: true,
        vibixType: data.vibixType,
        vibixUploadedAt: data.vibixUploadedAt,
        vibixLastSyncAt: syncedAt,
        isPublished: true,
      },
    });
    return "updated" as const;
  }

  await prisma.movie.create({
    data: {
      slug: await uniqueSlug(data.title, data.year),
      titleRu: data.title,
      titleOriginal: data.titleOriginal,
      description: `${data.title} (${data.year}) доступен для просмотра на REDFILM.`,
      year: data.year,
      type: data.type,
      posterUrl: data.posterUrl,
      quality: data.quality,
      kinopoiskId: data.kinopoiskId,
      imdbId: data.imdbId,
      vibixId: data.vibixId,
      vibixIframeUrl: data.iframeUrl,
      vibixAvailable: true,
      vibixType: data.vibixType,
      vibixUploadedAt: data.vibixUploadedAt,
      vibixLastSyncAt: syncedAt,
      isPublished: true,
    },
  });
  return "imported" as const;
}

export async function syncVibixVideos(options: SyncOptions = {}): Promise<VibixSyncResult> {
  if (vibixSyncState.__redfilmVibixSyncRunning) throw new VibixSyncAlreadyRunningError();
  vibixSyncState.__redfilmVibixSyncRunning = true;

  const startedAt = new Date().toISOString();
  const mode = options.mode ?? "quick";
  const quickPages = Math.max(1, Math.min(options.pages ?? 5, 1000));
  const limit = Math.max(1, Math.min(options.limit ?? 100, 200));
  const pageDelayMs = Math.max(250, Math.min(options.pageDelayMs ?? 2_000, 60_000));
  const maxPagesPerRun = Math.max(1, Math.min(options.maxPagesPerRun ?? (mode === "quick" ? quickPages : 20), 10_000));
  const pagesToProcess = mode === "quick" ? Math.min(quickPages, maxPagesPerRun) : maxPagesPerRun;
  const result: VibixSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    pagesProcessed: 0,
    totalFromVibix: 0,
    startedAt,
    finishedAt: startedAt,
    rateLimited: false,
    message: null,
  };
  let page = 1;
  let lastPage: number | null = null;
  let hasReportedTotal = false;

  try {
    while (page <= pagesToProcess) {
      if (lastPage !== null && page > lastPage) break;

      const response = await getVibixVideoLinks({ page, limit });
      if (response.rateLimited) {
        result.rateLimited = true;
        result.message = "Vibix API rate limit reached";
        break;
      }
      if (response.requestFailed) {
        result.errors += 1;
        result.message = "Vibix API request failed";
        break;
      }
      if (response.meta?.lastPage !== null && response.meta?.lastPage !== undefined) {
        lastPage = Math.min(Math.max(1, response.meta.lastPage), 10_000);
      }
      if (response.meta?.total !== null && response.meta?.total !== undefined) {
        result.totalFromVibix = Math.max(0, response.meta.total);
        hasReportedTotal = true;
      }
      if (!response.data.length) break;

      result.pagesProcessed += 1;
      if (!hasReportedTotal) result.totalFromVibix += response.data.length;

      for (const video of response.data) {
        try {
          const status = await saveVibixVideo(video);
          result[status] += 1;
        } catch (error) {
          result.errors += 1;
          console.warn("[Vibix] Failed to save video:", error instanceof Error ? error.message : error);
        }
      }
      const hasMorePages = page < pagesToProcess && (lastPage === null || page < lastPage);
      page += 1;
      if (hasMorePages) await sleep(pageDelayMs);
    }

    result.finishedAt = new Date().toISOString();
    return result;
  } finally {
    vibixSyncState.__redfilmVibixSyncRunning = false;
  }
}

export async function ensureVibixPlayback(movie: Movie) {
  if (movie.vibixIframeUrl) return movie;
  let video = movie.kinopoiskId ? await getVibixVideoByKpId(movie.kinopoiskId) : null;
  if (!video && movie.imdbId) video = await getVibixVideoByImdbId(movie.imdbId);
  if (!video || !videoData(video)) return movie;
  await saveVibixVideo(video, movie.id);
  return (await prisma.movie.findUnique({ where: { id: movie.id } })) ?? movie;
}
