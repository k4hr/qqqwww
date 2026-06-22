ALTER TABLE "VibixCatalogIndex"
  ADD COLUMN IF NOT EXISTS "indexSource" TEXT NOT NULL DEFAULT 'kpids',
  ADD COLUMN IF NOT EXISTS "vibixId" INTEGER,
  ADD COLUMN IF NOT EXISTS "imdbId" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "year" INTEGER,
  ADD COLUMN IF NOT EXISTS "hasPlayableLink" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "detailAvailable" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "detailCheckedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rawJson" JSONB;

CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_indexSource_idx" ON "VibixCatalogIndex"("indexSource");
CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_detailAvailable_idx" ON "VibixCatalogIndex"("detailAvailable");
