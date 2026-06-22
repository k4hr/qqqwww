CREATE TABLE IF NOT EXISTS "VibixReferenceItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "vibixId" INTEGER NOT NULL,
    "name" TEXT,
    "nameEng" TEXT,
    "code" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VibixReferenceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VibixReferenceItem_kind_vibixId_key" ON "VibixReferenceItem"("kind", "vibixId");
CREATE INDEX IF NOT EXISTS "VibixReferenceItem_kind_idx" ON "VibixReferenceItem"("kind");
CREATE INDEX IF NOT EXISTS "VibixReferenceItem_kind_name_idx" ON "VibixReferenceItem"("kind", "name");
CREATE INDEX IF NOT EXISTS "VibixReferenceItem_code_idx" ON "VibixReferenceItem"("code");

CREATE TABLE IF NOT EXISTS "VibixCatalogSnapshot" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceType" TEXT,
    "filterKind" TEXT,
    "filterId" INTEGER,
    "total" INTEGER,
    "lastPage" INTEGER,
    "perPage" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VibixCatalogSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VibixCatalogSnapshot_key_key" ON "VibixCatalogSnapshot"("key");
CREATE INDEX IF NOT EXISTS "VibixCatalogSnapshot_sourceType_idx" ON "VibixCatalogSnapshot"("sourceType");
CREATE INDEX IF NOT EXISTS "VibixCatalogSnapshot_filterKind_filterId_idx" ON "VibixCatalogSnapshot"("filterKind", "filterId");
CREATE INDEX IF NOT EXISTS "VibixCatalogSnapshot_lastCheckedAt_idx" ON "VibixCatalogSnapshot"("lastCheckedAt");

CREATE TABLE IF NOT EXISTS "VibixCatalogIndex" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "kpId" TEXT NOT NULL,
    "categoryId" INTEGER,
    "categoryName" TEXT,
    "sourcePage" INTEGER,
    "importStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "importedMovieId" TEXT,
    "lastImportError" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VibixCatalogIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VibixCatalogIndex_sourceType_kpId_key" ON "VibixCatalogIndex"("sourceType", "kpId");
CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_sourceType_idx" ON "VibixCatalogIndex"("sourceType");
CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_sourceType_categoryId_idx" ON "VibixCatalogIndex"("sourceType", "categoryId");
CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_importStatus_sourceType_idx" ON "VibixCatalogIndex"("importStatus", "sourceType");
CREATE INDEX IF NOT EXISTS "VibixCatalogIndex_kpId_idx" ON "VibixCatalogIndex"("kpId");
