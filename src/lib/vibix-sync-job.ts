import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toTimestamp } from "@/lib/date-utils";
import { normalizeVibixKpIdsLimit, normalizeVibixLimit, sleep, type VibixCatalogType } from "@/lib/vibix";
import { syncVibixKpIdPage, syncVibixPage, type VibixPageSyncResult } from "@/lib/vibix-sync";

export type VibixJobContentType = "movie" | "serial" | "both";

type CreateJobOptions = {
  contentType?: VibixJobContentType;
  limit?: number;
  pageDelayMs?: number;
  detailDelayMs?: number;
  forceRestart?: boolean;
  resumeFromExisting?: boolean;
  startType?: VibixCatalogType;
  startPage?: number;
};

const ACTIVE_STATUSES = ["QUEUED", "RUNNING"];
const RECOVERABLE_STATUSES = ["QUEUED", "RUNNING", "PAUSED", "FAILED"];
const STOPPED_STATUSES = ["DONE", "CANCELED"];
// /links uses 20-item pages for the already imported database progress.
// /get_kpids has a separate 100+ limit and must not reuse this value.
const SAFE_LINK_LIMITS = [20];
const MAX_SKIPPED_PAGE_LOG = 80;

type SkippedPageRecord = {
  type: string;
  page: number;
  at: string;
  error: string | null;
};

function normalizeDelay(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

function normalizeContentType(value: unknown): VibixJobContentType {
  return ["movie", "serial", "both"].includes(String(value ?? "")) ? value as VibixJobContentType : "both";
}

function normalizeStartPage(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 200_000);
}

function normalizeStartType(value: unknown): VibixCatalogType {
  return value === "serial" ? "serial" : "movie";
}

function pageFromCount(count: number, limit: number) {
  return Math.max(1, Math.floor(Math.max(0, count) / Math.max(1, limit)) + 1);
}

function movieLikeWhere(): Prisma.MovieWhereInput {
  return {
    OR: [
      { vibixType: "movie" },
      { type: { in: [ContentType.MOVIE, ContentType.CARTOON, ContentType.ANIME] } },
    ],
    AND: [
      {
        OR: [
          { vibixId: { not: null } },
          { vibixAvailable: true },
          { vibixIframeUrl: { not: null } },
          { vibixEmbedCode: { not: null } },
        ],
      },
    ],
  };
}

function serialLikeWhere(): Prisma.MovieWhereInput {
  return {
    OR: [
      { vibixType: "serial" },
      { type: ContentType.SERIES },
    ],
    AND: [
      {
        OR: [
          { vibixId: { not: null } },
          { vibixAvailable: true },
          { vibixIframeUrl: { not: null } },
          { vibixEmbedCode: { not: null } },
        ],
      },
    ],
  };
}

export type VibixFullSyncResumeEstimate = {
  limit: number;
  movieCount: number;
  serialCount: number;
  moviePage: number;
  serialPage: number;
  recommendedType: VibixCatalogType;
  recommendedPage: number;
  note: string;
};

export async function getVibixFullSyncResumeEstimate(limitInput: unknown = 20): Promise<VibixFullSyncResumeEstimate> {
  const limit = normalizeVibixLimit(limitInput);
  const [movieCount, serialCount] = await Promise.all([
    prisma.movie.count({ where: movieLikeWhere() }),
    prisma.movie.count({ where: serialLikeWhere() }),
  ]);
  const moviePage = pageFromCount(movieCount, limit);
  const serialPage = pageFromCount(serialCount, limit);
  const recommendedType: VibixCatalogType = movieCount > 0 ? "movie" : "serial";
  const recommendedPage = recommendedType === "movie" ? moviePage : serialPage;
  return {
    limit,
    movieCount,
    serialCount,
    moviePage,
    serialPage,
    recommendedType,
    recommendedPage,
    note: `В базе уже примерно ${movieCount} movie-like и ${serialCount} serial-like Vibix-записей. При limit=${limit} безопасное продолжение: movie page ${moviePage}, serial page ${serialPage}.`,
  };
}

function parseSkippedPages(value: string | null): SkippedPageRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const page = Number(record.page);
      const type = typeof record.type === "string" ? record.type : null;
      const at = typeof record.at === "string" ? record.at : new Date().toISOString();
      const error = typeof record.error === "string" ? record.error : null;
      if (!type || !Number.isSafeInteger(page) || page < 1) return [];
      return [{ type, page, at, error }];
    });
  } catch {
    return [];
  }
}

function appendSkippedPage(job: { skippedPagesJson: string | null }, page: number, type: string, error: string | null) {
  const records = parseSkippedPages(job.skippedPagesJson ?? null);
  records.push({ type, page, at: new Date().toISOString(), error });
  return JSON.stringify(records.slice(-MAX_SKIPPED_PAGE_LOG));
}

function pageError(result: VibixPageSyncResult) {
  if (result.httpStatus) {
    return [`HTTP ${result.httpStatus} ${result.httpStatusText || "Request failed"}`, result.httpBodyPreview]
      .filter(Boolean)
      .join(": ")
      .slice(0, 2_000);
  }
  return result.message || "Vibix page sync failed";
}

function isServerFailure(result: VibixPageSyncResult) {
  return result.httpStatus !== null && result.httpStatus >= 500;
}

function uniqueLinkLimits(baseLimit: number) {
  return Array.from(new Set([normalizeVibixLimit(baseLimit), ...SAFE_LINK_LIMITS].filter((value) => value > 0)));
}

async function processPageWithFallbacks(job: { nextPage: number; currentType: string; limit: number; detailDelayMs: number }) {
  let lastResult: VibixPageSyncResult | null = null;
  const catalogType = job.currentType as VibixCatalogType;

  for (const limit of uniqueLinkLimits(job.limit)) {
    lastResult = await syncVibixPage({
      page: job.nextPage,
      type: catalogType,
      limit,
      detailDelayMs: job.detailDelayMs,
    });

    if (!lastResult.message || lastResult.rateLimited) {
      return { result: lastResult, note: limit === job.limit ? null : `OK через /links с limit=${limit}` };
    }

    if (!isServerFailure(lastResult)) return { result: lastResult, note: null };

    console.warn(`[VibixWorker] /links failed with ${lastResult.httpStatus} for ${job.currentType} page ${job.nextPage}, limit ${limit}. Trying safer fallback.`);
    await sleep(2_000);
  }

  const kpFallbackLimit = normalizeVibixKpIdsLimit(100);
  const kpResult = await syncVibixKpIdPage({
    page: job.nextPage,
    type: catalogType,
    limit: kpFallbackLimit,
    detailDelayMs: job.detailDelayMs,
  });

  if (!kpResult.message || kpResult.rateLimited) {
    return { result: kpResult, note: `OK через /get_kpids + /kp с limit=${kpFallbackLimit}` };
  }

  return { result: kpResult, note: lastResult ? `Fallback /get_kpids тоже упал. Последняя ошибка /links: ${pageError(lastResult)}` : null };
}

export async function createVibixFullSyncJob(options: CreateJobOptions = {}) {
  const existing = await prisma.vibixSyncJob.findFirst({
    where: { status: { in: RECOVERABLE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (existing && !options.forceRestart) return { job: existing, created: false, reused: true };

  if (existing && options.forceRestart) {
    await prisma.vibixSyncJob.updateMany({
      where: { status: { in: RECOVERABLE_STATUSES } },
      data: { status: "CANCELED", finishedAt: new Date(), safeResumeNote: "Canceled before forced full sync restart." },
    });
  }

  const contentType = normalizeContentType(options.contentType);
  const limit = normalizeVibixLimit(options.limit);
  const estimate = options.resumeFromExisting ? await getVibixFullSyncResumeEstimate(limit) : null;
  const startType = normalizeStartType(options.startType ?? estimate?.recommendedType ?? (contentType === "serial" ? "serial" : "movie"));
  const startPage = normalizeStartPage(options.startPage ?? estimate?.recommendedPage ?? 1);
  return {
    created: true,
    reused: false,
    job: await prisma.vibixSyncJob.create({
      data: {
        contentType,
        currentType: startType,
        nextPage: startPage,
        limit,
        pageDelayMs: normalizeDelay(options.pageDelayMs, 10_000, 10_000, 60_000),
        detailDelayMs: normalizeDelay(options.detailDelayMs, 2_000, 2_000, 10_000),
        safeResumeNote: options.resumeFromExisting
          ? `Created from existing database resume. ${estimate?.note ?? ""}`
          : startPage > 1
            ? `Created from admin panel at ${startType} page ${startPage}.`
            : "Created from admin full sync panel.",
      },
    }),
  };
}

export async function processVibixSyncJob(jobId: string) {
  let job = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
  if (!job || STOPPED_STATUSES.includes(job.status) || job.status === "PAUSED") return job;

  job = await prisma.vibixSyncJob.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      startedAt: job.startedAt ?? new Date(),
      finishedAt: null,
      limit: normalizeVibixLimit(job.limit || 50),
      pageDelayMs: Math.max(job.pageDelayMs, 10_000),
      detailDelayMs: Math.max(job.detailDelayMs, 2_000),
    },
  });

  try {
    while (true) {
      const current = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
      if (!current || !ACTIVE_STATUSES.includes(current.status)) return current;

      if (current.rateLimitUntil) {
        const remainingMs = toTimestamp(current.rateLimitUntil) - Date.now();
        if (remainingMs > 0) {
          await sleep(remainingMs);
          continue;
        }
        await prisma.vibixSyncJob.update({ where: { id: jobId }, data: { rateLimited: false, rateLimitUntil: null } });
      }

      const { result: page, note } = await processPageWithFallbacks(current);
      if (page.rateLimited) {
        const retryAfterMs = Math.max(1_000, page.retryAfterMs ?? 3_600_000);
        const rateLimitUntil = new Date(Date.now() + retryAfterMs);
        await prisma.vibixSyncJob.update({
          where: { id: jobId },
          data: {
            status: "RUNNING",
            rateLimited: true,
            rateLimitUntil,
            lastError: `${pageError(page)}. Retry at ${rateLimitUntil.toISOString()}`,
            safeResumeNote: "Vibix returned 429. Worker is waiting for retry-after/backoff.",
          },
        });
        await sleep(retryAfterMs);
        continue;
      }
      if (page.message) {
        if (isServerFailure(page)) {
          return prisma.vibixSyncJob.update({
            where: { id: jobId },
            data: {
              status: "PAUSED",
              rateLimited: false,
              rateLimitUntil: null,
              errors: { increment: Math.max(1, page.errors) },
              lastError: `${pageError(page)}. Страница НЕ потеряна: можно повторить её позже или нажать “Пропустить страницу и продолжить”.`,
              lastFailedType: current.currentType,
              lastFailedPage: current.nextPage,
              lastFailedAt: new Date(),
              safeResumeNote: note || "Vibix returned persistent 5xx for this page after safer fallbacks.",
              finishedAt: new Date(),
            },
          });
        }
        return prisma.vibixSyncJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            rateLimited: page.rateLimited,
            errors: { increment: Math.max(1, page.errors) },
            lastError: pageError(page),
            lastFailedType: current.currentType,
            lastFailedPage: current.nextPage,
            lastFailedAt: new Date(),
            safeResumeNote: note,
            finishedAt: new Date(),
          },
        });
      }

      const lastPage = page.lastPage ?? current.lastPage;
      const reachedEnd = lastPage !== null ? current.nextPage >= lastPage : page.itemsReceived === 0;
      let total = current.total;
      if (current.nextPage === 1 && page.total !== null) {
        total = current.currentType === "serial" && current.contentType === "both"
          ? (current.total ?? 0) + page.total
          : page.total;
      }
      const counters = {
        imported: { increment: page.imported },
        updated: { increment: page.updated },
        skipped: { increment: page.skipped },
        errors: { increment: page.errors },
        playerByIframe: { increment: page.playerSourceByIframeUrl },
        playerByEmbed: { increment: page.playerSourceByEmbedCode },
        rateLimited: false,
        rateLimitUntil: null,
        lastError: null,
        lastFailedType: null,
        lastFailedPage: null,
        lastFailedAt: null,
        safeResumeNote: note,
        total,
      };

      if (reachedEnd) {
        const switchToSerial = current.currentType === "movie" && current.contentType === "both";
        job = await prisma.vibixSyncJob.update({
          where: { id: jobId },
          data: switchToSerial
            ? { ...counters, currentType: "serial", nextPage: 1, lastPage: null }
            : { ...counters, status: "DONE", lastPage, finishedAt: new Date() },
        });
        if (!switchToSerial) return job;
      } else {
        job = await prisma.vibixSyncJob.update({
          where: { id: jobId },
          data: { ...counters, nextPage: current.nextPage + 1, lastPage },
        });
      }

      await sleep(job.pageDelayMs);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Vibix worker error";
    console.error("[VibixWorker] Job failed:", message);
    return prisma.vibixSyncJob.update({
      where: { id: jobId },
      data: { status: "PAUSED", errors: { increment: 1 }, lastError: message.slice(0, 2_000), safeResumeNote: "Worker error. Resume will retry the same page.", finishedAt: new Date() },
    });
  }
}

export async function pauseVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({ where: { id: jobId, status: { in: ACTIVE_STATUSES } }, data: { status: "PAUSED", safeResumeNote: "Paused manually from admin panel." } });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export async function resumeVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({
    where: { id: jobId, status: { in: ["PAUSED", "FAILED"] } },
    data: { status: "QUEUED", finishedAt: null, rateLimited: false, rateLimitUntil: null, safeResumeNote: "Queued to retry the same page." },
  });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export async function skipCurrentVibixSyncJob(jobId: string) {
  const job = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
  if (!job || STOPPED_STATUSES.includes(job.status)) return job;

  const skippedPage = job.nextPage;
  const skippedType = job.currentType;
  const skippedPagesJson = appendSkippedPage(job, skippedPage, skippedType, job.lastError ?? null);

  return prisma.vibixSyncJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      nextPage: skippedPage + 1,
      skipped: { increment: 1 },
      errors: { increment: 1 },
      lastSkippedType: skippedType,
      lastSkippedPage: skippedPage,
      skippedPagesJson,
      lastError: null,
      lastFailedType: null,
      lastFailedPage: null,
      lastFailedAt: null,
      finishedAt: null,
      rateLimited: false,
      rateLimitUntil: null,
      safeResumeNote: `Skipped ${skippedType} page ${skippedPage}; queued next page ${skippedPage + 1}.`,
    },
  });
}


export async function setVibixSyncJobStartPage(
  jobId: string,
  options: { startType?: VibixCatalogType; startPage?: number; contentType?: VibixJobContentType; resumeFromExisting?: boolean } = {},
) {
  const job = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
  if (!job || STOPPED_STATUSES.includes(job.status)) return job;

  const contentType = normalizeContentType(options.contentType ?? job.contentType);
  const limit = normalizeVibixLimit(job.limit || 20);
  const estimate = options.resumeFromExisting ? await getVibixFullSyncResumeEstimate(limit) : null;
  const startType = normalizeStartType(options.startType ?? estimate?.recommendedType ?? job.currentType);
  const startPage = normalizeStartPage(options.startPage ?? estimate?.recommendedPage ?? job.nextPage);

  return prisma.vibixSyncJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      contentType,
      currentType: startType,
      nextPage: startPage,
      limit,
      lastPage: null,
      total: null,
      lastError: null,
      lastFailedType: null,
      lastFailedPage: null,
      lastFailedAt: null,
      finishedAt: null,
      rateLimited: false,
      rateLimitUntil: null,
      safeResumeNote: options.resumeFromExisting
        ? `Moved to existing database resume: ${startType} page ${startPage}. ${estimate?.note ?? ""}`
        : `Moved manually to ${startType} page ${startPage}.`,
    },
  });
}

export async function cancelVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({ where: { id: jobId, status: { notIn: STOPPED_STATUSES } }, data: { status: "CANCELED", finishedAt: new Date(), safeResumeNote: "Canceled manually from admin panel." } });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export function getLatestVibixSyncJob() {
  return prisma.vibixSyncJob.findFirst({ orderBy: { createdAt: "desc" } });
}
