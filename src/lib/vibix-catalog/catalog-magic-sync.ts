import { prisma } from "@/lib/prisma";
import { sleep } from "@/lib/vibix";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { createSimilarityJob, getSimilarityJobSnapshot, processSimilarityJobBatch } from "@/lib/similarity/similarity-job";
import { checkTrendCandidatesInVibix, recalculateAllHomeScores, runTrendSync } from "@/lib/trend-engine";
import {
  buildVibixPlayableLinksIndexBatch,
  importMissingFromVibixIndex,
  refreshVibixCatalogAudit,
  verifyAndRepairImportantVibixCoverage,
} from "@/lib/vibix-catalog/catalog-audit";

const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "PAUSED"];

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function nowPlus(ms: number) {
  return new Date(Date.now() + Math.max(1_000, ms));
}

function clampMs(value: number | null | undefined, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, numeric));
}

function rateLimitCooldownMs(job: { failed: number }, retryAfterMs?: number | null) {
  const minMs = envInt("VIBIX_CATALOG_429_MIN_COOLDOWN_MS", 5 * 60_000, 30_000, 60 * 60_000);
  const maxMs = envInt("VIBIX_CATALOG_429_MAX_COOLDOWN_MS", 30 * 60_000, 60_000, 2 * 60 * 60_000);
  const fallbackSteps = [5 * 60_000, 10 * 60_000, 20 * 60_000, 30 * 60_000];
  const fallback = fallbackSteps[Math.min(Math.max(0, job.failed), fallbackSteps.length - 1)] ?? 30 * 60_000;

  // Vibix sometimes returns Retry-After: 3600 for short bursts. Do not lock the whole
  // REDFILM pipeline for an hour during ordinary /links checks; cap it and continue gently.
  return clampMs(retryAfterMs, fallback, minMs, maxMs);
}

function softenedPagesPerRun(current: number) {
  return Math.min(current, envInt("VIBIX_CATALOG_SOFT_PAGES_PER_RUN", 5, 1, 15));
}

function softenedPageDelayMs(current: number) {
  return Math.max(current, envInt("VIBIX_CATALOG_SOFT_PAGE_DELAY_MS", 7000, 1000, 60_000));
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function statusLabel(status: string) {
  if (status === "QUEUED") return "в очереди";
  if (status === "RUNNING") return "работает";
  if (status === "PAUSED") return "пауза";
  if (status === "COMPLETED") return "завершено";
  if (status === "CANCELED") return "отменено";
  return status;
}

type VibixCatalogMagicJob = Awaited<ReturnType<typeof prisma.vibixCatalogAutoJob.findFirst>>;

async function resumeExpiredPausedJob(job: VibixCatalogMagicJob): Promise<VibixCatalogMagicJob> {
  if (!job || job.status !== "PAUSED" || !job.rateLimitUntil) return job;
  if (job.rateLimitUntil.getTime() > Date.now()) return job;

  return prisma.vibixCatalogAutoJob.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      rateLimitUntil: null,
      message: `Пауза уже прошла. Задача снова в очереди: ${job.currentStage}, ${job.currentType}, page ${job.nextPage}.`,
    },
  });
}

export async function getLatestVibixCatalogMagicJob() {
  const job = await prisma.vibixCatalogAutoJob.findFirst({ orderBy: { createdAt: "desc" } });
  return resumeExpiredPausedJob(job);
}

export async function startVibixCatalogMagicJob(options: { restart?: boolean } = {}) {
  if (options.restart) {
    await prisma.vibixCatalogAutoJob.updateMany({
      where: { status: { in: ACTIVE_STATUSES } },
      data: { status: "CANCELED", finishedAt: new Date(), message: "Остановлено перед новым запуском." },
    });
  }

  const active = await prisma.vibixCatalogAutoJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return prisma.vibixCatalogAutoJob.update({
      where: { id: active.id },
      data: {
        status: "QUEUED",
        rateLimitUntil: null,
        message: "Продолжаю волшебную загрузку каталога Vibix.",
        lastError: null,
      },
    });
  }

  return createCatalogPipelineJob({
    mode: "FULL_CATALOG",
    currentStage: "REFRESH",
    message: "Задача создана. Worker сам обновит Vibix, построит /links индекс, догрузит недостающее, посчитает похожие и пересчитает каталог.",
  });
}

type CatalogPipelineMode = "FULL_CATALOG" | "CHECK_VIBIX" | "IMPORT_MISSING" | "DAILY_PIPELINE";

type CreateCatalogPipelineOptions = {
  mode: CatalogPipelineMode;
  currentStage: string;
  restart?: boolean;
  message: string;
};

async function createCatalogPipelineJob(options: CreateCatalogPipelineOptions) {
  if (options.restart) {
    await prisma.vibixCatalogAutoJob.updateMany({
      where: { status: { in: ACTIVE_STATUSES } },
      data: { status: "CANCELED", finishedAt: new Date(), message: "Остановлено перед запуском нового операционного сценария." },
    });
  }

  const active = await prisma.vibixCatalogAutoJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return prisma.vibixCatalogAutoJob.update({
      where: { id: active.id },
      data: {
        status: "QUEUED",
        mode: options.mode,
        currentStage: options.currentStage,
        currentType: options.currentStage === "INDEX_LINKS" ? "movie" : "both",
        nextPage: 1,
        rateLimitUntil: null,
        message: options.message,
        lastError: null,
      },
    });
  }

  return prisma.vibixCatalogAutoJob.create({
    data: {
      status: "QUEUED",
      mode: options.mode,
      currentStage: options.currentStage,
      currentType: options.currentStage === "INDEX_LINKS" || options.currentStage === "REFRESH" ? "movie" : "both",
      nextPage: 1,
      pagesPerRun: envInt("VIBIX_CATALOG_PAGES_PER_RUN", 5, 1, 30),
      importBatchSize: envInt("VIBIX_CATALOG_IMPORT_BATCH_SIZE", 100, 10, 500),
      pageDelayMs: envInt("VIBIX_CATALOG_PAGE_DELAY_MS", 7000, 250, 60_000),
      message: options.message,
    },
  });
}

export async function startVibixCatalogCheckJob(options: { restart?: boolean } = {}) {
  return createCatalogPipelineJob({
    mode: "CHECK_VIBIX",
    currentStage: "REFRESH",
    restart: options.restart,
    message: "Проверка новых Vibix создана: обновлю totals/snapshots и построю /links индекс, чтобы показать свежие missing без массового импорта.",
  });
}

export async function startVibixCatalogImportJob(options: { restart?: boolean } = {}) {
  return createCatalogPipelineJob({
    mode: "IMPORT_MISSING",
    currentStage: "IMPORT_MISSING",
    restart: options.restart,
    message: "Догрузка найденного создана: импортирую missing из текущего /links индекса, обновлю существующие карточки, затем починю покрытие и пересчитаю витрину.",
  });
}

export async function startDailyCatalogPipelineJob(options: { restart?: boolean } = {}) {
  return createCatalogPipelineJob({
    mode: "DAILY_PIPELINE",
    currentStage: "REFRESH",
    restart: options.restart,
    message: "Ежедневный pipeline создан: Vibix → импорт → repair → похожие → тренды → витрина.",
  });
}

export async function startVibixCoverageRepairJob(options: { restart?: boolean } = {}) {
  if (options.restart) {
    await prisma.vibixCatalogAutoJob.updateMany({
      where: { status: { in: ACTIVE_STATUSES } },
      data: { status: "CANCELED", finishedAt: new Date(), message: "Остановлено перед автопочинкой покрытия." },
    });
  }

  const active = await prisma.vibixCatalogAutoJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return prisma.vibixCatalogAutoJob.update({
      where: { id: active.id },
      data: {
        status: "QUEUED",
        currentStage: "VERIFY_COVERAGE",
        currentType: "both",
        nextPage: 1,
        rateLimitUntil: null,
        message: "Переключаю активную задачу на автопроверку важных тайтлов Vibix: ложные совпадения, скрытые, wrong type/player.",
        lastError: null,
      },
    });
  }

  return prisma.vibixCatalogAutoJob.create({
    data: {
      status: "QUEUED",
      mode: "COVERAGE_REPAIR",
      currentStage: "VERIFY_COVERAGE",
      currentType: "both",
      nextPage: 1,
      pagesPerRun: envInt("VIBIX_CATALOG_PAGES_PER_RUN", 5, 1, 30),
      importBatchSize: envInt("VIBIX_CATALOG_IMPORT_BATCH_SIZE", 100, 10, 500),
      pageDelayMs: envInt("VIBIX_CATALOG_PAGE_DELAY_MS", 7000, 250, 60_000),
      message: "Задача автопочинки создана. Worker проверит /links индекс, импортирует важные отсутствующие, поправит type/player и пересчитает каталог.",
    },
  });
}

export async function cancelVibixCatalogMagicJob() {
  const active = await prisma.vibixCatalogAutoJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return null;
  return prisma.vibixCatalogAutoJob.update({
    where: { id: active.id },
    data: { status: "CANCELED", finishedAt: new Date(), message: "Остановлено из админки." },
  });
}

async function getRunnableJob(options: { force?: boolean } = {}) {
  let job = await prisma.vibixCatalogAutoJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;

  job = await resumeExpiredPausedJob(job);
  if (!job) return null;

  if (!options.force && job.rateLimitUntil && job.rateLimitUntil.getTime() > Date.now()) {
    return job;
  }

  if (options.force && job.status === "PAUSED") {
    job = await prisma.vibixCatalogAutoJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        rateLimitUntil: null,
        message: `Пауза снята вручную. Продолжаю: ${job.currentStage}, ${job.currentType}, page ${job.nextPage}.`,
      },
    });
  }

  if (job.status !== "RUNNING") {
    return prisma.vibixCatalogAutoJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: job.startedAt ?? new Date(),
        rateLimitUntil: null,
        message: `Worker продолжил: ${job.currentStage}, ${job.currentType}, page ${job.nextPage}.`,
      },
    });
  }

  return job;
}

async function pauseJob(jobId: string, message: string, delayMs: number, lastError?: string) {
  return prisma.vibixCatalogAutoJob.update({
    where: { id: jobId },
    data: {
      status: "PAUSED",
      rateLimitUntil: nowPlus(delayMs),
      message,
      lastError: lastError ? lastError.slice(0, 2_000) : undefined,
    },
  });
}

export async function runVibixCatalogMagicJobIteration(options: { force?: boolean } = {}) {
  const job = await getRunnableJob(options);
  if (!job) {
    return { ok: true, idle: true, message: "Нет активной задачи Vibix catalog magic." };
  }

  if (job.rateLimitUntil && job.rateLimitUntil.getTime() > Date.now()) {
    return {
      ok: true,
      idle: true,
      message: `Пауза из-за лимита Vibix. Продолжение после ${job.rateLimitUntil.toISOString()}.`,
      job,
    };
  }

  try {
    if (job.currentStage === "REFRESH") {
      const result = await refreshVibixCatalogAudit();
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          currentStage: "INDEX_LINKS",
          currentType: "movie",
          nextPage: 1,
          loops: { increment: 1 },
          message: `Vibix справочники/totals обновлены. Перехожу к индексу фильмов. ${result.message}`,
          lastError: result.ok ? null : JSON.stringify(result.details ?? result).slice(0, 2_000),
        },
      });
      return { ok: result.ok, message: updated.message, job: updated, details: result };
    }

    if (job.currentStage === "INDEX_LINKS") {
      const sourceType = job.currentType === "serial" ? "serial" : "movie";
      const maxAvailablePages = envInt("VIBIX_AVAILABLE_MAX_PAGES_PER_TYPE", 650, 50, 5_000);
      if (job.nextPage > maxAvailablePages) {
        if (sourceType === "movie") {
          const updated = await prisma.vibixCatalogAutoJob.update({
            where: { id: job.id },
            data: {
              currentType: "serial",
              nextPage: 1,
              message: `Достигнут безопасный лимит /links страниц для фильмов (${maxAvailablePages}). Перехожу к сериалам, чтобы не сканировать общий миллионный каталог Vibix.`,
            },
          });
          return { ok: true, message: updated.message, job: updated };
        }
        const checkOnly = job.mode === "CHECK_VIBIX";
        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            status: checkOnly ? "COMPLETED" : "RUNNING",
            currentStage: checkOnly ? "DONE" : "IMPORT_MISSING",
            currentType: "both",
            nextPage: 1,
            finishedAt: checkOnly ? new Date() : undefined,
            message: checkOnly
              ? `Достигнут безопасный лимит /links страниц (${maxAvailablePages}). Проверка завершена без скана общего миллионного каталога.`
              : `Достигнут безопасный лимит /links страниц (${maxAvailablePages}). Перехожу к импорту найденного available-индекса.`,
          },
        });
        return { ok: true, message: updated.message, job: updated };
      }

      const result = await buildVibixPlayableLinksIndexBatch({
        sourceType,
        startPage: job.nextPage,
        pages: job.pagesPerRun,
        pageDelayMs: job.pageDelayMs,
        useFields: false,
        limit: envInt("VIBIX_CATALOG_LINKS_LIMIT", 50, 1, 50),
        availableOnly: true,
        existKpId: true,
        noAds: null,
        lgbt: null,
      });
      const nextPage = job.nextPage + result.scannedPages;
      const pageMessage = `${sourceType}: /links page ${job.nextPage}–${Math.max(job.nextPage, nextPage - 1)}; найдено ${result.indexed}, новых ${result.missingImportable}, уже есть ${result.present}.`;

      if (result.failed > 0) {
        const delayMs = result.rateLimited
          ? rateLimitCooldownMs(job, result.retryAfterMs)
          : envInt("VIBIX_CATALOG_ERROR_COOLDOWN_MS", 3 * 60_000, 30_000, 30 * 60_000);
        const nextPagesPerRun = result.rateLimited ? softenedPagesPerRun(job.pagesPerRun) : job.pagesPerRun;
        const nextPageDelayMs = result.rateLimited ? softenedPageDelayMs(job.pageDelayMs) : job.pageDelayMs;
        await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            nextPage,
            lastPageDone: result.scannedPages > 0 ? nextPage - 1 : job.lastPageDone,
            pagesPerRun: nextPagesPerRun,
            pageDelayMs: nextPageDelayMs,
            indexed: { increment: result.indexed },
            present: { increment: result.present },
            missing: { increment: result.missingImportable },
            failed: { increment: result.failed },
            loops: { increment: 1 },
          },
        });
        const minutes = Math.ceil(delayMs / 60_000);
        const paused = await pauseJob(
          job.id,
          `${pageMessage} Vibix дал 429/ошибку. Снижаю скорость до ${nextPagesPerRun} страниц за проход и задержки ${Math.round(nextPageDelayMs / 1000)} сек. Автоматически продолжу с page ${nextPage} примерно через ${minutes} мин.`,
          delayMs,
          result.errors.join("\n"),
        );
        return { ok: false, message: paused.message, job: paused, details: result };
      }

      if (result.emptyPages > 0) {
        if (sourceType === "movie") {
          const updated = await prisma.vibixCatalogAutoJob.update({
            where: { id: job.id },
            data: {
              currentType: "serial",
              nextPage: 1,
              indexed: { increment: result.indexed },
              present: { increment: result.present },
              missing: { increment: result.missingImportable },
              loops: { increment: 1 },
              message: `${pageMessage} Фильмы закончились, перехожу к сериалам.`,
            },
          });
          return { ok: true, message: updated.message, job: updated, details: result };
        }

        const checkOnly = job.mode === "CHECK_VIBIX";
        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            status: checkOnly ? "COMPLETED" : "RUNNING",
            currentStage: checkOnly ? "DONE" : "IMPORT_MISSING",
            currentType: "both",
            nextPage: 1,
            indexed: { increment: result.indexed },
            present: { increment: result.present },
            missing: { increment: result.missingImportable },
            loops: { increment: 1 },
            finishedAt: checkOnly ? new Date() : undefined,
            message: checkOnly
              ? `${pageMessage} Проверка Vibix завершена. Новых к догрузке: ${result.missingImportable}.`
              : `${pageMessage} Индекс фильмов и сериалов завершён. Перехожу к догрузке недостающего.`,
          },
        });
        return { ok: true, message: updated.message, job: updated, details: result };
      }

      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          nextPage,
          lastPageDone: nextPage - 1,
          indexed: { increment: result.indexed },
          present: { increment: result.present },
          missing: { increment: result.missingImportable },
          loops: { increment: 1 },
          message: `${pageMessage} Продолжаю автоматически с page ${nextPage}.`,
        },
      });
      return { ok: true, message: updated.message, job: updated, details: result };
    }

    if (job.currentStage === "IMPORT_MISSING") {
      const result = await importMissingFromVibixIndex({ sourceType: "both", limit: job.importBatchSize });
      const failedText = result.errors.join("\n");
      const isRateLimited = /429|Too Many Requests/i.test(failedText);
      await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          imported: { increment: result.imported },
          updated: { increment: result.updated },
          skipped: { increment: result.skipped + result.detailMissing },
          failed: { increment: result.failed },
          loops: { increment: 1 },
        },
      });

      if (isRateLimited) {
        const delayMs = rateLimitCooldownMs(job);
        const paused = await pauseJob(
          job.id,
          `Vibix ограничил detail/import. Автоматически продолжу догрузку примерно через ${Math.ceil(delayMs / 60_000)} мин.`,
          delayMs,
          failedText,
        );
        return { ok: false, message: paused.message, job: paused, details: result };
      }

      if (result.requested === 0) {
        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            currentStage: "VERIFY_COVERAGE",
            currentType: "both",
            message: "Недостающих записей из /links индекса больше нет. Проверяю важные тайтлы на ложные совпадения, скрытие и неправильный type/player.",
          },
        });
        return { ok: true, message: updated.message, job: updated, details: result };
      }

      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          message: `Догрузка: импорт ${result.imported}, обновлено ${result.updated}, пропущено ${result.skipped + result.detailMissing}, ошибок ${result.failed}. Продолжаю следующий батч автоматически.`,
          lastError: result.failed > 0 ? failedText.slice(0, 2_000) : null,
        },
      });
      return { ok: result.failed === 0, message: updated.message, job: updated, details: result };
    }

    if (job.currentStage === "VERIFY_COVERAGE") {
      const result = await verifyAndRepairImportantVibixCoverage({ limit: job.importBatchSize });
      await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          imported: { increment: result.imported },
          updated: { increment: result.updated },
          skipped: { increment: result.verified + result.lowValue },
          failed: { increment: result.failed },
          loops: { increment: 1 },
        },
      });

      if (result.requested === 0) {
        const nextStage = job.mode === "DAILY_PIPELINE" || job.mode === "FULL_CATALOG" || job.mode === "IMPORT_MISSING"
          ? "QUEUE_SIMILARITY"
          : "RECALC";
        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            currentStage: nextStage,
            message: nextStage === "QUEUE_SIMILARITY"
              ? "Автопроверка важных тайтлов завершена. Перехожу к задаче похожих для новых/dirty фильмов."
              : "Автопроверка важных тайтлов завершена. Перехожу к пересчёту каталога и типов.",
            lastError: null,
          },
        });
        return { ok: true, message: updated.message, job: updated, details: result };
      }

      const failedText = result.errors.join("\n");
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          message: `Автопроверка покрытия: проверено ${result.requested}, auto-repair ${result.repaired}, импорт ${result.imported}, обновлено ${result.updated}, verified ${result.verified}, low-value skip ${result.lowValue}, ошибок ${result.failed}. Продолжаю следующий батч автоматически.`,
          lastError: result.failed > 0 ? failedText.slice(0, 2_000) : null,
        },
      });
      return { ok: result.failed === 0, message: updated.message, job: updated, details: result };
    }

    if (job.currentStage === "QUEUE_SIMILARITY") {
      const result = await createSimilarityJob({ mode: "DIRTY", batchSize: envInt("SIMILARITY_RECALCULATE_BATCH_SIZE", 100, 10, 500) });
      const snapshot = await getSimilarityJobSnapshot();
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          currentStage: snapshot.dirtyCount > 0 ? "PROCESS_SIMILARITY" : job.mode === "DAILY_PIPELINE" ? "TREND_SYNC" : "RECALC",
          loops: { increment: 1 },
          message: snapshot.dirtyCount > 0
            ? `Похожие поставлены в очередь (${snapshot.dirtyCount} dirty). Worker начнёт считать similarity батчами.`
            : job.mode === "DAILY_PIPELINE"
              ? "Dirty-фильмов для похожих нет. Перехожу к поиску трендов."
              : "Dirty-фильмов для похожих нет. Перехожу к пересчёту витрины.",
          lastError: null,
        },
      });
      return { ok: true, message: updated.message, job: updated, details: { result, snapshot } };
    }

    if (job.currentStage === "PROCESS_SIMILARITY") {
      const result = await processSimilarityJobBatch();
      const typed = result as { ok?: boolean; idle?: boolean; completed?: boolean; afterDirty?: number; error?: string; result?: { processed?: number; saved?: number; errors?: number } };
      const done = Boolean(typed.idle || typed.completed || (typeof typed.afterDirty === "number" && typed.afterDirty <= 0));
      const nextStage = job.mode === "DAILY_PIPELINE" ? "TREND_SYNC" : "RECALC";
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          currentStage: done ? nextStage : "PROCESS_SIMILARITY",
          failed: { increment: typed.ok === false ? 1 : 0 },
          loops: { increment: 1 },
          message: done
            ? `Похожие обработаны. Перехожу к ${nextStage === "TREND_SYNC" ? "трендам" : "пересчёту витрины"}.`
            : `Похожие считаются батчами: обработано ${typed.result?.processed ?? 0}, сохранено связей ${typed.result?.saved ?? 0}, ошибок ${typed.result?.errors ?? 0}.`,
          lastError: typed.ok === false ? (typed.error ?? "Similarity processing failed").slice(0, 2_000) : null,
        },
      });
      return { ok: typed.ok !== false, message: updated.message, job: updated, details: result };
    }

    if (job.currentStage === "TREND_SYNC") {
      const trend = await runTrendSync({ batchSize: envInt("TREND_SYNC_BATCH_SIZE", 50, 1, 100) });
      const candidates = await checkTrendCandidatesInVibix(envInt("TREND_CHECK_BATCH_SIZE", 50, 1, 100));
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          currentStage: "RECALC",
          loops: { increment: 1 },
          message: `Тренды проверены. Trend Sync: ${JSON.stringify(trend).slice(0, 350)}. Vibix candidates: ${JSON.stringify(candidates).slice(0, 350)}. Перехожу к финальной витрине.`,
          lastError: null,
        },
      });
      return { ok: true, message: updated.message, job: updated, details: { trend, candidates } };
    }

    if (job.currentStage === "RECALC") {
      const catalog = await recalculateAllCatalogScores();
      const home = await recalculateAllHomeScores();
      const errors = catalog.errors + home.errors;
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          currentStage: "DONE",
          finishedAt: new Date(),
          loops: { increment: 1 },
          message: `Pipeline завершён. Каталог: ${catalog.processed}; публичных ${catalog.publicVisible}; home ${home.homeEligible}; hero ${home.heroEligible}; ошибок ${errors}.`,
          lastError: errors > 0 ? JSON.stringify({ catalog, home }).slice(0, 2_000) : null,
        },
      });
      return { ok: errors === 0, message: updated.message, job: updated, details: { catalog, home } };
    }

    const completed = await prisma.vibixCatalogAutoJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", finishedAt: new Date(), message: "Задача завершена." },
    });
    return { ok: true, message: completed.message, job: completed };
  } catch (error) {
    const message = errorText(error);
    const paused = await pauseJob(job.id, `Ошибка worker: ${message}. Попробую продолжить позже.`, envInt("VIBIX_CATALOG_ERROR_COOLDOWN_MS", 3 * 60_000, 30_000, 30 * 60_000), message);
    return { ok: false, message: paused.message, job: paused };
  }
}

export async function runVibixCatalogMagicWorkerLoop() {
  const enabled = process.env.VIBIX_CATALOG_WORKER_ENABLED !== "false";
  if (!enabled) {
    console.log("[VibixCatalogWorker] Disabled by VIBIX_CATALOG_WORKER_ENABLED=false");
    return;
  }

  const intervalMs = envInt("VIBIX_CATALOG_WORKER_INTERVAL_MS", 30_000, 5_000, 10 * 60_000);
  console.log(`[VibixCatalogWorker] Started; interval=${intervalMs}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await runVibixCatalogMagicJobIteration();
    const resultForLog = result as { job?: { status: string }; message?: string | null };
    if (resultForLog.message) console.log(`[VibixCatalogWorker] ${statusLabel(resultForLog.job?.status ?? "IDLE")}: ${resultForLog.message}`);

    const latest = await getLatestVibixCatalogMagicJob();
    const waitUntil = latest?.status === "PAUSED" && latest.rateLimitUntil ? latest.rateLimitUntil.getTime() - Date.now() : null;
    const sleepMs = waitUntil && waitUntil > 0 ? Math.min(waitUntil, 10 * 60_000) : intervalMs;
    await sleep(sleepMs);
  }
}
