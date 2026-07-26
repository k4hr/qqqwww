CREATE TABLE "MovieArtworkSyncState" (
  "singletonKey" TEXT NOT NULL DEFAULT 'default',
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "phase" TEXT NOT NULL DEFAULT '1',
  "cursor" TEXT,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "deleted" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "batchSize" INTEGER NOT NULL DEFAULT 25,
  "concurrency" INTEGER NOT NULL DEFAULT 2,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MovieArtworkSyncState_pkey" PRIMARY KEY ("singletonKey")
);

CREATE INDEX "MovieArtworkSyncState_status_updatedAt_idx"
  ON "MovieArtworkSyncState"("status", "updatedAt");
