ALTER TABLE "Movie"
  ADD COLUMN "durationSource" TEXT,
  ADD COLUMN "durationLastSyncAt" TIMESTAMP(3);

CREATE TABLE "MovieDurationBackfillState" (
  "singletonKey" TEXT NOT NULL DEFAULT 'default',
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "cursor" TEXT,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "vibixUpdated" INTEGER NOT NULL DEFAULT 0,
  "tmdbUpdated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "batchSize" INTEGER NOT NULL DEFAULT 10,
  "remainingAtCompletion" INTEGER NOT NULL DEFAULT 0,
  "rateLimitUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MovieDurationBackfillState_pkey" PRIMARY KEY ("singletonKey")
);

CREATE INDEX "MovieDurationBackfillState_status_updatedAt_idx"
  ON "MovieDurationBackfillState"("status", "updatedAt");

CREATE INDEX "MovieDurationBackfillState_rateLimitUntil_idx"
  ON "MovieDurationBackfillState"("rateLimitUntil");

CREATE INDEX "Movie_duration_durationSource_idx"
  ON "Movie"("duration", "durationSource");
