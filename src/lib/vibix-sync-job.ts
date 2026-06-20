import { prisma } from "@/lib/prisma";
import { normalizeVibixLimit, sleep, type VibixCatalogType } from "@/lib/vibix";
import { syncVibixPage, type VibixPageSyncResult } from "@/lib/vibix-sync";

export type VibixJobContentType = "movie" | "serial" | "both";

type CreateJobOptions = {
  contentType?: VibixJobContentType;
  limit?: number;
  pageDelayMs?: number;
  detailDelayMs?: number;
};

const ACTIVE_STATUSES = ["QUEUED", "RUNNING"];
const STOPPED_STATUSES = ["DONE", "CANCELED"];

function normalizeDelay(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

export async function createVibixFullSyncJob(options: CreateJobOptions = {}) {
  const existing = await prisma.vibixSyncJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { job: existing, created: false };

  const contentType: VibixJobContentType = ["movie", "serial", "both"].includes(options.contentType ?? "")
    ? options.contentType as VibixJobContentType
    : "both";
  return {
    created: true,
    job: await prisma.vibixSyncJob.create({
      data: {
        contentType,
        currentType: contentType === "serial" ? "serial" : "movie",
        limit: normalizeVibixLimit(options.limit),
        pageDelayMs: normalizeDelay(options.pageDelayMs, 2_000, 250, 60_000),
        detailDelayMs: normalizeDelay(options.detailDelayMs, 500, 500, 10_000),
      },
    }),
  };
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

async function processPageWithRetries(job: { nextPage: number; currentType: string; limit: number; detailDelayMs: number }) {
  let lastResult: VibixPageSyncResult | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    lastResult = await syncVibixPage({
      page: job.nextPage,
      type: job.currentType as VibixCatalogType,
      limit: job.limit,
      detailDelayMs: job.detailDelayMs,
    });
    const temporary = lastResult.rateLimited
      || (lastResult.httpStatus !== null && lastResult.httpStatus >= 500)
      || (lastResult.message !== null && lastResult.httpStatus === null);
    if (!lastResult.message || !temporary || attempt === 3) return lastResult;
    await sleep(15_000 * attempt);
  }
  return lastResult as VibixPageSyncResult;
}

export async function processVibixSyncJob(jobId: string) {
  let job = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
  if (!job || STOPPED_STATUSES.includes(job.status) || job.status === "PAUSED") return job;

  job = await prisma.vibixSyncJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: job.startedAt ?? new Date(), finishedAt: null },
  });

  try {
    while (true) {
      const current = await prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
      if (!current || !ACTIVE_STATUSES.includes(current.status)) return current;

      const page = await processPageWithRetries(current);
      if (page.message) {
        return prisma.vibixSyncJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            rateLimited: page.rateLimited,
            errors: { increment: Math.max(1, page.errors) },
            lastError: pageError(page),
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
        lastError: null,
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
      data: { status: "FAILED", errors: { increment: 1 }, lastError: message.slice(0, 2_000), finishedAt: new Date() },
    });
  }
}

export async function pauseVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({ where: { id: jobId, status: { in: ACTIVE_STATUSES } }, data: { status: "PAUSED" } });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export async function resumeVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({ where: { id: jobId, status: { in: ["PAUSED", "FAILED"] } }, data: { status: "QUEUED", rateLimited: false, lastError: null, finishedAt: null } });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export async function cancelVibixSyncJob(jobId: string) {
  await prisma.vibixSyncJob.updateMany({ where: { id: jobId, status: { notIn: STOPPED_STATUSES } }, data: { status: "CANCELED", finishedAt: new Date() } });
  return prisma.vibixSyncJob.findUnique({ where: { id: jobId } });
}

export function getLatestVibixSyncJob() {
  return prisma.vibixSyncJob.findFirst({ orderBy: { createdAt: "desc" } });
}
