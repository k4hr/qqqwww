ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "catalogScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "popularScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "topScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "freshScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "isPublicVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "isPopularEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "isTopEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "isFreshEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "lastCatalogScoreAt" TIMESTAMP(3);
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "lastVibixEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "lastVibixSeenAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "VibixUpdateCursor" (
  "id" TEXT NOT NULL,
  "type" "ContentType" NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'vibix',
  "mode" TEXT NOT NULL DEFAULT 'updates',
  "lastPage" INTEGER NOT NULL DEFAULT 1,
  "lastSeenUploadedAt" TIMESTAMP(3),
  "lastSeenUpdatedAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastError" TEXT,
  "isRunning" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VibixUpdateCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogEngineRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "found" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "enriched" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogEngineRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Movie_isPublicVisible_catalogScore_idx" ON "Movie"("isPublicVisible", "catalogScore");
CREATE INDEX IF NOT EXISTS "Movie_isPopularEligible_popularScore_idx" ON "Movie"("isPopularEligible", "popularScore");
CREATE INDEX IF NOT EXISTS "Movie_isTopEligible_topScore_idx" ON "Movie"("isTopEligible", "topScore");
CREATE INDEX IF NOT EXISTS "Movie_isFreshEligible_freshScore_idx" ON "Movie"("isFreshEligible", "freshScore");
CREATE INDEX IF NOT EXISTS "VibixUpdateCursor_type_source_mode_idx" ON "VibixUpdateCursor"("type", "source", "mode");
CREATE INDEX IF NOT EXISTS "VibixUpdateCursor_lastRunAt_idx" ON "VibixUpdateCursor"("lastRunAt");
CREATE INDEX IF NOT EXISTS "CatalogEngineRun_status_mode_createdAt_idx" ON "CatalogEngineRun"("status", "mode", "createdAt");
