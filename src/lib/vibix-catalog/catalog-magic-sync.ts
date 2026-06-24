import { prisma } from "@/lib/prisma";
import { sleep } from "@/lib/vibix";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
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

  return prisma.vibixCatalogAutoJob.create({
    data: {
      status: "QUEUED",
      mode: "FULL_CATALOG",
      currentStage: "REFRESH",
      currentType: "movie",
      nextPage: 1,
      pagesPerRun: envInt("VIBIX_CATALOG_PAGES_PER_RUN", 15, 1, 30),
      importBatchSize: envInt("VIBIX_CATALOG_IMPORT_BATCH_SIZE", 100, 10, 500),
      pageDelayMs: envInt("VIBIX_CATALOG_PAGE_DELAY_MS", 2500, 250, 30_000),
      message: "Задача создана. Worker сам обновит Vibix, построит /links индекс, догрузит недостающее и пересчитает каталог.",
    },
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
      pagesPerRun: envInt("VIBIX_CATALOG_PAGES_PER_RUN", 15, 1, 30),
      importBatchSize: envInt("VIBIX_CATALOG_IMPORT_BATCH_SIZE", 100, 10, 500),
      pageDelayMs: envInt("VIBIX_CATALOG_PAGE_DELAY_MS", 2500, 250, 30_000),
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
      const result = await buildVibixPlayableLinksIndexBatch({
        sourceType,
        startPage: job.nextPage,
        pages: job.pagesPerRun,
        pageDelayMs: job.pageDelayMs,
        useFields: false,
        existKpId: null,
        noAds: null,
        lgbt: null,
      });
      const nextPage = job.nextPage + result.scannedPages;
      const pageMessage = `${sourceType}: /links page ${job.nextPage}–${Math.max(job.nextPage, nextPage - 1)}; найдено ${result.indexed}, новых ${result.missingImportable}, уже есть ${result.present}.`;

      if (result.failed > 0) {
        const delayMs = result.rateLimited ? (result.retryAfterMs ?? envInt("VIBIX_CATALOG_429_COOLDOWN_MS", 10 * 60_000, 60_000, 60 * 60_000)) : envInt("VIBIX_CATALOG_ERROR_COOLDOWN_MS", 3 * 60_000, 30_000, 30 * 60_000);
        await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            nextPage,
            lastPageDone: result.scannedPages > 0 ? nextPage - 1 : job.lastPageDone,
            indexed: { increment: result.indexed },
            present: { increment: result.present },
            missing: { increment: result.missingImportable },
            failed: { increment: result.failed },
            loops: { increment: 1 },
          },
        });
        const paused = await pauseJob(
          job.id,
          `${pageMessage} Vibix ограничил/уронил запрос. Автоматически продолжу с page ${nextPage} после паузы.`,
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

        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            currentStage: "IMPORT_MISSING",
            currentType: "both",
            nextPage: 1,
            indexed: { increment: result.indexed },
            present: { increment: result.present },
            missing: { increment: result.missingImportable },
            loops: { increment: 1 },
            message: `${pageMessage} Индекс фильмов и сериалов завершён. Перехожу к догрузке недостающего.`,
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
        const paused = await pauseJob(
          job.id,
          `Vibix ограничил detail/import. Автоматически продолжу догрузку после паузы.`,
          envInt("VIBIX_CATALOG_429_COOLDOWN_MS", 10 * 60_000, 60_000, 60 * 60_000),
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
        const updated = await prisma.vibixCatalogAutoJob.update({
          where: { id: job.id },
          data: {
            currentStage: "RECALC",
            message: "Автопроверка важных тайтлов завершена. Перехожу к пересчёту каталога и типов.",
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

    if (job.currentStage === "RECALC") {
      const result = await recalculateAllCatalogScores();
      const updated = await prisma.vibixCatalogAutoJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          currentStage: "DONE",
          finishedAt: new Date(),
          loops: { increment: 1 },
          message: `Волшебная загрузка завершена. Каталог пересчитан: ${result.processed}; публичных ${result.publicVisible}; ошибок ${result.errors}.`,
          lastError: result.errors > 0 ? JSON.stringify(result).slice(0, 2_000) : null,
        },
      });
      return { ok: result.errors === 0, message: updated.message, job: updated, details: result };
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
