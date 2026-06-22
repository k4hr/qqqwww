ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "similarityCalculatedAt" TIMESTAMP(3);
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "similarityDirty" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "similarityDirtyReason" TEXT;

CREATE INDEX IF NOT EXISTS "Movie_similarityDirty_similarityCalculatedAt_idx" ON "Movie"("similarityDirty", "similarityCalculatedAt");

CREATE TABLE IF NOT EXISTS "SimilarityJob" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "mode" TEXT NOT NULL DEFAULT 'DIRTY',
  "total" INTEGER,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "saved" INTEGER NOT NULL DEFAULT 0,
  "deleted" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "batchSize" INTEGER NOT NULL DEFAULT 100,
  "targetLimit" INTEGER NOT NULL DEFAULT 24,
  "minScore" DOUBLE PRECISION NOT NULL DEFAULT 180,
  "cursorMovieId" TEXT,
  "lastMovieTitle" TEXT,
  "message" TEXT,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimilarityJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimilarityJob_status_createdAt_idx" ON "SimilarityJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SimilarityJob_mode_status_idx" ON "SimilarityJob"("mode", "status");
CREATE INDEX IF NOT EXISTS "SimilarityJob_updatedAt_idx" ON "SimilarityJob"("updatedAt");
