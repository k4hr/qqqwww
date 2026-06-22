import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import {
  countDirtyMovieSimilarities,
  markAllMovieSimilaritiesDirty,
  recalculateDirtyMovieSimilarities,
} from "@/lib/similarity/recalculate-similarities";

const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "PAUSED"];
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELED"];

function serializeSimilarityJob<T extends { createdAt: Date; updatedAt: Date; startedAt?: Date | null; finishedAt?: Date | null } | null>(job: T) {
  if (!job) return null;
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}

type CreateSimilarityJobOptions = {
  mode?: "ALL" | "DIRTY";
  batchSize?: number;
  targetLimit?: number;
  minScore?: number;
  force?: boolean;
};

function normalizeBatchSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(10, Math.min(Math.trunc(parsed), 500));
}

function normalizeTargetLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 24;
  return Math.max(6, Math.min(Math.trunc(parsed), 60));
}

function normalizeMinScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 180;
  return Math.max(0, Math.min(parsed, 2000));
}

export async function getSimilarityJobSnapshot() {
  const [latestJob, dirtyCount, totalPublic, cachedSources, linksCount] = await Promise.all([
    prisma.similarityJob.findFirst({ orderBy: { createdAt: "desc" } }),
    countDirtyMovieSimilarities(),
    prisma.movie.count({ where: vibixPublicMovieWhere }),
    prisma.movieSimilarity.findMany({ select: { sourceMovieId: true }, distinct: ["sourceMovieId"], take: 1 }).catch(() => []),
    prisma.movieSimilarity.count().catch(() => 0),
  ]);

  return {
    latestJob: serializeSimilarityJob(latestJob),
    dirtyCount,
    totalPublic,
    hasCachedSources: cachedSources.length > 0,
    linksCount,
    activeStatuses: ACTIVE_STATUSES,
    terminalStatuses: TERMINAL_STATUSES,
  };
}

export async function createSimilarityJob(options: CreateSimilarityJobOptions = {}) {
  const mode = options.mode === "ALL" ? "ALL" : "DIRTY";
  const batchSize = normalizeBatchSize(options.batchSize);
  const targetLimit = normalizeTargetLimit(options.targetLimit);
  const minScore = normalizeMinScore(options.minScore);

  const activeJob = await prisma.similarityJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (activeJob && !options.force) {
    return { created: false, reason: "active_job_exists", job: activeJob };
  }

  if (activeJob && options.force) {
    await prisma.similarityJob.update({
      where: { id: activeJob.id },
      data: { status: "CANCELED", finishedAt: new Date(), message: "Canceled automatically before creating a new similarity job." },
    });
  }

  if (mode === "ALL") await markAllMovieSimilaritiesDirty("manual_all_recalculate");
  const total = await countDirtyMovieSimilarities();

  const job = await prisma.similarityJob.create({
    data: {
      status: total > 0 ? "QUEUED" : "COMPLETED",
      mode,
      total,
      batchSize,
      targetLimit,
      minScore,
      message: total > 0
        ? mode === "ALL"
          ? "Queued full similarity recalculation for all public Vibix movies."
          : "Queued similarity recalculation for dirty/new movies."
        : "No dirty movies found.",
      startedAt: total > 0 ? null : new Date(),
      finishedAt: total > 0 ? null : new Date(),
    },
  });

  return { created: true, job };
}

export async function cancelActiveSimilarityJob() {
  const activeJob = await prisma.similarityJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (!activeJob) return { canceled: false, reason: "no_active_job" };
  const job = await prisma.similarityJob.update({
    where: { id: activeJob.id },
    data: { status: "CANCELED", finishedAt: new Date(), message: "Canceled manually from admin panel." },
  });
  return { canceled: true, job };
}

export async function processSimilarityJobBatch() {
  let job = await prisma.similarityJob.findFirst({
    where: { status: { in: ["RUNNING", "QUEUED"] } },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
  });

  if (!job) return { ok: true, idle: true, message: "No queued similarity jobs." };

  if (job.status === "QUEUED") {
    job = await prisma.similarityJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: job.startedAt ?? new Date(), message: "Similarity job is running." },
    });
  }

  const beforeDirty = await countDirtyMovieSimilarities();

  if (beforeDirty <= 0) {
    const completed = await prisma.similarityJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", finishedAt: new Date(), message: "Similarity recalculation completed." },
    });
    return { ok: true, completed: true, job: completed };
  }

  try {
    const result = await recalculateDirtyMovieSimilarities({
      limit: job.batchSize,
      targetLimit: job.targetLimit,
      minScore: job.minScore,
    });

    const afterDirty = await countDirtyMovieSimilarities();
    const shouldComplete = afterDirty <= 0 || result.processed <= 0;

    const updated = await prisma.similarityJob.update({
      where: { id: job.id },
      data: {
        status: shouldComplete ? "COMPLETED" : "RUNNING",
        processed: { increment: result.processed },
        saved: { increment: result.saved },
        deleted: { increment: result.deleted },
        errors: { increment: result.errors },
        lastMovieTitle: result.examples.at(-1)?.source ?? job.lastMovieTitle,
        message: shouldComplete
          ? "Similarity recalculation completed."
          : `Processed ${result.processed}; dirty left: ${afterDirty}.`,
        finishedAt: shouldComplete ? new Date() : null,
      },
    });

    return { ok: true, idle: false, completed: shouldComplete, beforeDirty, afterDirty, result, job: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Similarity worker failed.";
    const failed = await prisma.similarityJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: message, message: "Similarity job failed.", finishedAt: new Date(), errors: { increment: 1 } },
    });
    return { ok: false, error: message, job: failed };
  }
}

export async function autoQueueDirtySimilarityJob() {
  const activeJob = await prisma.similarityJob.findFirst({ where: { status: { in: ACTIVE_STATUSES } } });
  if (activeJob) return { created: false, reason: "active_job_exists", job: activeJob };
  const dirtyCount = await countDirtyMovieSimilarities();
  if (dirtyCount <= 0) return { created: false, reason: "no_dirty_movies" };
  return createSimilarityJob({ mode: "DIRTY" });
}

export async function runSimilarityWorkerLoop() {
  const enabled = process.env.SIMILARITY_WORKER_ENABLED !== "false";
  const intervalSeconds = Math.max(10, Math.min(Number(process.env.SIMILARITY_WORKER_INTERVAL_SECONDS || 45), 3600));
  const autoQueue = process.env.SIMILARITY_AUTO_QUEUE_DIRTY !== "false";

  console.log(`[SimilarityWorker] Started. enabled=${enabled}; interval=${intervalSeconds}s; autoQueue=${autoQueue}`);

  while (enabled) {
    try {
      if (autoQueue) await autoQueueDirtySimilarityJob();
      const result = await processSimilarityJobBatch();
      const typedResult = result as { idle?: boolean };
      if (typedResult.idle) console.log("[SimilarityWorker] idle");
      else console.log("[SimilarityWorker]", JSON.stringify(result));
    } catch (error) {
      console.error("[SimilarityWorker] loop error", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}
