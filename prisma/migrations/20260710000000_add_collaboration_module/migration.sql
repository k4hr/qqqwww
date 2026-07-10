CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BLOCKED');
CREATE TYPE "PartnerAttributionModel" AS ENUM ('FIRST_CLICK_LOCKED', 'LAST_CLICK');
CREATE TYPE "PartnerLinkTargetType" AS ENUM ('AUTHOR_HUB', 'COLLECTION', 'MOVIE', 'HOME', 'CUSTOM');
CREATE TYPE "PartnerEventType" AS ENUM ('LINK_CLICK', 'UNIQUE_VISITOR', 'RETURN_VISIT', 'AUTHOR_HUB_OPEN', 'COLLECTION_OPEN', 'MOVIE_OPEN', 'PLAYER_START', 'AD_VIEW', 'AD_CLICK');
CREATE TYPE "CreatorCollectionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "PartnerRevenueStatus" AS ENUM ('DRAFT', 'CALCULATED', 'CONFIRMED', 'CLOSED', 'PAID');
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "PartnerRevenuePeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "publicName" TEXT,
  "cabinetTitle" TEXT,
  "slug" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "email" TEXT,
  "avatarUrl" TEXT,
  "coverUrl" TEXT,
  "description" TEXT,
  "commissionPercent" DECIMAL(5,2) NOT NULL,
  "attributionDays" INTEGER NOT NULL DEFAULT 30,
  "attributionModel" "PartnerAttributionModel" NOT NULL DEFAULT 'FIRST_CLICK_LOCKED',
  "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
  "canManageCollections" BOOLEAN NOT NULL DEFAULT true,
  "requireCollectionModeration" BOOLEAN NOT NULL DEFAULT true,
  "showFinancials" BOOLEAN NOT NULL DEFAULT true,
  "linksBlocked" BOOLEAN NOT NULL DEFAULT false,
  "adminComment" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerSession" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerLoginAttempt" (
  "id" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "ipHash" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerLink" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "source" TEXT,
  "targetType" "PartnerLinkTargetType" NOT NULL,
  "targetUrl" TEXT,
  "collectionId" TEXT,
  "movieId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerVisitor" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerVisitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerAttribution" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "partnerLinkId" TEXT,
  "attributionModel" "PartnerAttributionModel" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerEvent" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "attributionId" TEXT,
  "visitorId" TEXT NOT NULL,
  "partnerLinkId" TEXT,
  "collectionId" TEXT,
  "movieId" TEXT,
  "type" "PartnerEventType" NOT NULL,
  "revenueAmount" DECIMAL(18,8),
  "source" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorHub" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorHub_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorCollection" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverUrl" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" "CreatorCollectionStatus" NOT NULL DEFAULT 'DRAFT',
  "moderationComment" TEXT,
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorCollectionMovie" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "movieId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "authorComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorCollectionMovie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonetizationRate" (
  "id" TEXT NOT NULL,
  "playerStartRate" DECIMAL(18,8) NOT NULL,
  "videoViewRate" DECIMAL(18,8) NOT NULL,
  "videoClickRate" DECIMAL(18,8) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonetizationRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerCommissionRate" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "percent" DECIMAL(5,2) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "PartnerCommissionRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerRevenuePeriod" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "periodType" "PartnerRevenuePeriodType" NOT NULL DEFAULT 'CUSTOM',
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "playerStarts" INTEGER NOT NULL DEFAULT 0,
  "videoViews" INTEGER NOT NULL DEFAULT 0,
  "videoClicks" INTEGER NOT NULL DEFAULT 0,
  "playerStartRateSnapshot" DECIMAL(18,8) NOT NULL,
  "videoViewRateSnapshot" DECIMAL(18,8) NOT NULL,
  "videoClickRateSnapshot" DECIMAL(18,8) NOT NULL,
  "commissionPercentSnapshot" DECIMAL(5,2) NOT NULL,
  "estimatedGrossRevenue" DECIMAL(18,8) NOT NULL,
  "confirmedGrossRevenue" DECIMAL(18,8),
  "manualAdjustment" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "partnerCommission" DECIMAL(18,8),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PartnerRevenueStatus" NOT NULL DEFAULT 'DRAFT',
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerRevenuePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerPayout" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "revenuePeriodId" TEXT,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,8) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");
CREATE UNIQUE INDEX "Partner_login_key" ON "Partner"("login");
CREATE INDEX "Partner_status_idx" ON "Partner"("status");
CREATE INDEX "Partner_createdAt_idx" ON "Partner"("createdAt");
CREATE UNIQUE INDEX "PartnerSession_tokenHash_key" ON "PartnerSession"("tokenHash");
CREATE INDEX "PartnerSession_partnerId_idx" ON "PartnerSession"("partnerId");
CREATE INDEX "PartnerSession_expiresAt_idx" ON "PartnerSession"("expiresAt");
CREATE INDEX "PartnerLoginAttempt_login_createdAt_idx" ON "PartnerLoginAttempt"("login", "createdAt");
CREATE INDEX "PartnerLoginAttempt_ipHash_createdAt_idx" ON "PartnerLoginAttempt"("ipHash", "createdAt");
CREATE UNIQUE INDEX "PartnerLink_partnerId_slug_key" ON "PartnerLink"("partnerId", "slug");
CREATE INDEX "PartnerLink_partnerId_isActive_idx" ON "PartnerLink"("partnerId", "isActive");
CREATE INDEX "PartnerLink_collectionId_idx" ON "PartnerLink"("collectionId");
CREATE INDEX "PartnerLink_movieId_idx" ON "PartnerLink"("movieId");
CREATE UNIQUE INDEX "PartnerVisitor_visitorId_key" ON "PartnerVisitor"("visitorId");
CREATE INDEX "PartnerVisitor_lastVisitAt_idx" ON "PartnerVisitor"("lastVisitAt");
CREATE INDEX "PartnerAttribution_visitorId_isActive_expiresAt_idx" ON "PartnerAttribution"("visitorId", "isActive", "expiresAt");
CREATE INDEX "PartnerAttribution_partnerId_startedAt_idx" ON "PartnerAttribution"("partnerId", "startedAt");
CREATE INDEX "PartnerAttribution_partnerLinkId_idx" ON "PartnerAttribution"("partnerLinkId");
CREATE INDEX "PartnerEvent_partnerId_createdAt_idx" ON "PartnerEvent"("partnerId", "createdAt");
CREATE INDEX "PartnerEvent_visitorId_createdAt_idx" ON "PartnerEvent"("visitorId", "createdAt");
CREATE INDEX "PartnerEvent_type_createdAt_idx" ON "PartnerEvent"("type", "createdAt");
CREATE INDEX "PartnerEvent_partnerLinkId_createdAt_idx" ON "PartnerEvent"("partnerLinkId", "createdAt");
CREATE INDEX "PartnerEvent_collectionId_createdAt_idx" ON "PartnerEvent"("collectionId", "createdAt");
CREATE INDEX "PartnerEvent_movieId_createdAt_idx" ON "PartnerEvent"("movieId", "createdAt");
CREATE UNIQUE INDEX "CreatorHub_partnerId_key" ON "CreatorHub"("partnerId");
CREATE UNIQUE INDEX "CreatorHub_slug_key" ON "CreatorHub"("slug");
CREATE INDEX "CreatorHub_isPublished_idx" ON "CreatorHub"("isPublished");
CREATE UNIQUE INDEX "CreatorCollection_hubId_slug_key" ON "CreatorCollection"("hubId", "slug");
CREATE INDEX "CreatorCollection_partnerId_status_idx" ON "CreatorCollection"("partnerId", "status");
CREATE INDEX "CreatorCollection_hubId_position_idx" ON "CreatorCollection"("hubId", "position");
CREATE UNIQUE INDEX "CreatorCollectionMovie_collectionId_movieId_key" ON "CreatorCollectionMovie"("collectionId", "movieId");
CREATE INDEX "CreatorCollectionMovie_collectionId_position_idx" ON "CreatorCollectionMovie"("collectionId", "position");
CREATE INDEX "CreatorCollectionMovie_movieId_idx" ON "CreatorCollectionMovie"("movieId");
CREATE INDEX "MonetizationRate_effectiveFrom_effectiveTo_idx" ON "MonetizationRate"("effectiveFrom", "effectiveTo");
CREATE INDEX "PartnerCommissionRate_partnerId_effectiveFrom_idx" ON "PartnerCommissionRate"("partnerId", "effectiveFrom");
CREATE UNIQUE INDEX "PartnerRevenuePeriod_partnerId_periodFrom_periodTo_key" ON "PartnerRevenuePeriod"("partnerId", "periodFrom", "periodTo");
CREATE INDEX "PartnerRevenuePeriod_partnerId_status_idx" ON "PartnerRevenuePeriod"("partnerId", "status");
CREATE INDEX "PartnerRevenuePeriod_periodFrom_periodTo_idx" ON "PartnerRevenuePeriod"("periodFrom", "periodTo");
CREATE INDEX "PartnerPayout_partnerId_status_idx" ON "PartnerPayout"("partnerId", "status");
CREATE INDEX "PartnerPayout_revenuePeriodId_idx" ON "PartnerPayout"("revenuePeriodId");
CREATE INDEX "PartnerPayout_createdAt_idx" ON "PartnerPayout"("createdAt");
