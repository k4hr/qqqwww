CREATE TABLE "MovieEvent" (
    "id" TEXT NOT NULL,
    "movieId" TEXT,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "query" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovieEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MovieEvent_movieId_idx" ON "MovieEvent"("movieId");
CREATE INDEX "MovieEvent_type_idx" ON "MovieEvent"("type");
CREATE INDEX "MovieEvent_createdAt_idx" ON "MovieEvent"("createdAt");
CREATE INDEX "SearchEvent_query_idx" ON "SearchEvent"("query");
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");
