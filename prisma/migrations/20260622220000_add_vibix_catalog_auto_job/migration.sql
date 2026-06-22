CREATE TABLE IF NOT EXISTS "VibixCatalogAutoJob" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "mode" TEXT NOT NULL DEFAULT 'FULL_CATALOG',
  "currentStage" TEXT NOT NULL DEFAULT 'REFRESH',
  "currentType" TEXT NOT NULL DEFAULT 'movie',
  "nextPage" INTEGER NOT NULL DEFAULT 1,
  "pagesPerRun" INTEGER NOT NULL DEFAULT 15,
  "importBatchSize" INTEGER NOT NULL DEFAULT 100,
  "pageDelayMs" INTEGER NOT NULL DEFAULT 2500,
  "rateLimitUntil" TIMESTAMP(3),
  "indexed" INTEGER NOT NULL DEFAULT 0,
  "present" INTEGER NOT NULL DEFAULT 0,
  "missing" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "loops" INTEGER NOT NULL DEFAULT 0,
  "lastPageDone" INTEGER,
  "lastError" TEXT,
  "message" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VibixCatalogAutoJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VibixCatalogAutoJob_status_createdAt_idx" ON "VibixCatalogAutoJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "VibixCatalogAutoJob_currentStage_currentType_idx" ON "VibixCatalogAutoJob"("currentStage", "currentType");
CREATE INDEX IF NOT EXISTS "VibixCatalogAutoJob_rateLimitUntil_idx" ON "VibixCatalogAutoJob"("rateLimitUntil");
