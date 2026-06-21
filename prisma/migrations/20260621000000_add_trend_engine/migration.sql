ALTER TABLE "Movie"
  ADD COLUMN "kpVotes" INTEGER,
  ADD COLUMN "imdbVotes" INTEGER,
  ADD COLUMN "tmdbVotes" INTEGER,
  ADD COLUMN "tmdbPopularity" DOUBLE PRECISION,
  ADD COLUMN "homeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "evergreenScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "articleMentionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "franchiseScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "actorPowerScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "isHomeEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isHeroEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isTrendingEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isEvergreenEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isQualityDataComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastTrendSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastQualitySyncAt" TIMESTAMP(3),
  ADD COLUMN "lastExternalEnrichmentAt" TIMESTAMP(3);

CREATE TABLE "TrendCandidate" (
  "id" TEXT NOT NULL,
  "type" "ContentType" NOT NULL,
  "titleRu" TEXT,
  "titleOriginal" TEXT NOT NULL,
  "year" INTEGER,
  "tmdbId" TEXT,
  "imdbId" TEXT,
  "kpId" TEXT,
  "source" TEXT NOT NULL,
  "sourceCategory" TEXT NOT NULL,
  "sourceRank" INTEGER,
  "sourceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tmdbPopularity" DOUBLE PRECISION,
  "tmdbVoteAverage" DOUBLE PRECISION,
  "tmdbVoteCount" INTEGER,
  "posterUrl" TEXT,
  "backdropUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "movieId" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrendCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrendSyncRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "candidatesFound" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "notInVibix" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrendSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalArticleMention" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "sourceName" TEXT,
  "publishedAt" TIMESTAMP(3),
  "detectedTitle" TEXT,
  "detectedYear" INTEGER,
  "detectedType" "ContentType",
  "tmdbId" TEXT,
  "imdbId" TEXT,
  "kpId" TEXT,
  "mentionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rawSnippet" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalArticleMention_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Movie_isHomeEligible_homeScore_idx" ON "Movie"("isHomeEligible", "homeScore");
CREATE INDEX "Movie_isHeroEligible_homeScore_idx" ON "Movie"("isHeroEligible", "homeScore");
CREATE INDEX "Movie_isTrendingEligible_trendScore_idx" ON "Movie"("isTrendingEligible", "trendScore");
CREATE INDEX "TrendCandidate_type_year_idx" ON "TrendCandidate"("type", "year");
CREATE INDEX "TrendCandidate_status_idx" ON "TrendCandidate"("status");
CREATE INDEX "TrendCandidate_sourceCategory_idx" ON "TrendCandidate"("sourceCategory");
CREATE INDEX "TrendCandidate_sourceScore_idx" ON "TrendCandidate"("sourceScore");
CREATE INDEX "TrendCandidate_tmdbId_idx" ON "TrendCandidate"("tmdbId");
CREATE INDEX "TrendCandidate_imdbId_idx" ON "TrendCandidate"("imdbId");
CREATE INDEX "TrendCandidate_kpId_idx" ON "TrendCandidate"("kpId");
CREATE INDEX "ExternalArticleMention_tmdbId_idx" ON "ExternalArticleMention"("tmdbId");
CREATE INDEX "ExternalArticleMention_imdbId_idx" ON "ExternalArticleMention"("imdbId");
CREATE INDEX "ExternalArticleMention_detectedYear_idx" ON "ExternalArticleMention"("detectedYear");
CREATE INDEX "ExternalArticleMention_mentionScore_idx" ON "ExternalArticleMention"("mentionScore");
