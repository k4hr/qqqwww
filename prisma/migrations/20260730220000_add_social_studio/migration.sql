CREATE TYPE "SocialProvider" AS ENUM ('VK');
CREATE TYPE "SocialIntegrationStatus" AS ENUM ('DISCONNECTED','CONNECTED','ERROR');
CREATE TYPE "SocialPostType" AS ENUM ('TEXT','IMAGE_POST','GALLERY','CLIP');
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT','RESEARCHING','GENERATING','NEEDS_REVIEW','APPROVED','SCHEDULED','PUBLISHING','PROCESSING','PUBLISHED','FAILED','CANCELLED');
CREATE TYPE "SocialMediaKind" AS ENUM ('IMAGE','VIDEO','VIDEO_COVER','VIDEO_FRAME','GIF');
CREATE TYPE "SocialMediaSourceType" AS ENUM ('MANUAL_UPLOAD','REDFILM','TMDB','OFFICIAL_SOURCE','WEB_RESEARCH','OPENAI_GENERATED');
CREATE TYPE "SocialMediaStatus" AS ENUM ('PENDING_UPLOAD','READY','PROCESSING','REJECTED','DELETED');
CREATE TYPE "SocialFactStatus" AS ENUM ('VERIFIED','PARTIALLY_SUPPORTED','UNVERIFIED','CONTRADICTED');
CREATE TYPE "SocialJobType" AS ENUM ('GENERATE_IDEAS','RESEARCH_TOPIC','GENERATE_POST','VERIFY_FACTS','FIND_IMAGES','ANALYZE_IMAGES','PUBLISH_VK_POST','UPLOAD_VK_CLIP','POLL_VK_VIDEO','COLLECT_METRICS','CLEAN_TEMP_OBJECTS');
CREATE TYPE "SocialJobStatus" AS ENUM ('PENDING','LEASED','RUNNING','RETRY','SUCCEEDED','FAILED','CANCELLED');
CREATE TYPE "SocialIdeaStatus" AS ENUM ('NEW','SELECTED','USED','REJECTED');

CREATE TABLE "SocialIntegration" (
  "id" TEXT PRIMARY KEY,
  "provider" "SocialProvider" NOT NULL,
  "status" "SocialIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "displayName" TEXT,
  "externalGroupId" TEXT,
  "encryptedAccessToken" TEXT,
  "tokenLastFour" TEXT,
  "capabilities" JSONB,
  "lastCheckedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SocialIntegration_provider_key" ON "SocialIntegration"("provider");
CREATE INDEX "SocialIntegration_status_idx" ON "SocialIntegration"("status");

CREATE TABLE "SocialPost" (
  "id" TEXT PRIMARY KEY,
  "type" "SocialPostType" NOT NULL,
  "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT,
  "body" TEXT NOT NULL DEFAULT '',
  "hook" TEXT,
  "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "movieId" TEXT,
  "templateId" TEXT,
  "researchId" TEXT,
  "createdBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "externalPostId" TEXT,
  "externalVideoId" TEXT,
  "externalUrl" TEXT,
  "immutableSnapshot" JSONB,
  "utmCode" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SocialPost_utmCode_key" ON "SocialPost"("utmCode");
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status","scheduledAt");
CREATE INDEX "SocialPost_type_createdAt_idx" ON "SocialPost"("type","createdAt");
CREATE INDEX "SocialPost_movieId_idx" ON "SocialPost"("movieId");

CREATE TABLE "SocialMediaAsset" (
  "id" TEXT PRIMARY KEY,
  "kind" "SocialMediaKind" NOT NULL,
  "sourceType" "SocialMediaSourceType" NOT NULL,
  "status" "SocialMediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "storageProvider" TEXT NOT NULL DEFAULT 'R2',
  "bucket" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" BIGINT,
  "sha256" TEXT,
  "perceptualHash" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "fps" DOUBLE PRECISION,
  "videoCodec" TEXT,
  "audioCodec" TEXT,
  "sourceUrl" TEXT,
  "sourceDomain" TEXT,
  "sourceTitle" TEXT,
  "licenseStatus" TEXT,
  "attribution" TEXT,
  "watermarkDetected" BOOLEAN,
  "qualityScore" DOUBLE PRECISION,
  "relevanceScore" DOUBLE PRECISION,
  "duplicateGroup" TEXT,
  "metadata" JSONB,
  "uploadExpiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SocialMediaAsset_objectKey_key" ON "SocialMediaAsset"("objectKey");
CREATE INDEX "SocialMediaAsset_status_kind_idx" ON "SocialMediaAsset"("status","kind");
CREATE INDEX "SocialMediaAsset_sha256_idx" ON "SocialMediaAsset"("sha256");
CREATE INDEX "SocialMediaAsset_sourceDomain_idx" ON "SocialMediaAsset"("sourceDomain");

CREATE TABLE "SocialPostMedia" (
  "postId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "role" TEXT NOT NULL DEFAULT 'ATTACHMENT',
  "caption" TEXT,
  PRIMARY KEY ("postId","mediaAssetId"),
  CONSTRAINT "SocialPostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE,
  CONSTRAINT "SocialPostMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "SocialMediaAsset"("id") ON DELETE CASCADE
);
CREATE INDEX "SocialPostMedia_postId_position_idx" ON "SocialPostMedia"("postId","position");

CREATE TABLE "SocialResearch" (
  "id" TEXT PRIMARY KEY,
  "topic" TEXT NOT NULL,
  "query" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "summary" TEXT,
  "movieId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SocialResearch_status_createdAt_idx" ON "SocialResearch"("status","createdAt");
CREATE INDEX "SocialResearch_movieId_idx" ON "SocialResearch"("movieId");

CREATE TABLE "SocialResearchSource" (
  "id" TEXT PRIMARY KEY,
  "researchId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT,
  "sourceType" TEXT,
  "publishedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reliabilityScore" DOUBLE PRECISION,
  "contentHash" TEXT,
  "excerpt" TEXT,
  "metadata" JSONB,
  CONSTRAINT "SocialResearchSource_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "SocialResearch"("id") ON DELETE CASCADE
);
CREATE INDEX "SocialResearchSource_researchId_idx" ON "SocialResearchSource"("researchId");
CREATE INDEX "SocialResearchSource_domain_idx" ON "SocialResearchSource"("domain");

CREATE TABLE "SocialFact" (
  "id" TEXT PRIMARY KEY,
  "researchId" TEXT NOT NULL,
  "sourceId" TEXT,
  "claim" TEXT NOT NULL,
  "status" "SocialFactStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "confidence" DOUBLE PRECISION,
  "supportingExcerpt" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialFact_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "SocialResearch"("id") ON DELETE CASCADE,
  CONSTRAINT "SocialFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SocialResearchSource"("id") ON DELETE SET NULL
);
CREATE INDEX "SocialFact_researchId_status_idx" ON "SocialFact"("researchId","status");
CREATE INDEX "SocialFact_sourceId_idx" ON "SocialFact"("sourceId");

CREATE TABLE "SocialIdea" (
  "id" TEXT PRIMARY KEY,
  "topic" TEXT NOT NULL,
  "category" TEXT,
  "hook" TEXT,
  "movieId" TEXT,
  "noveltyScore" DOUBLE PRECISION,
  "potentialScore" DOUBLE PRECISION,
  "duplicateHash" TEXT,
  "status" "SocialIdeaStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SocialIdea_duplicateHash_key" ON "SocialIdea"("duplicateHash");
CREATE INDEX "SocialIdea_status_potentialScore_idx" ON "SocialIdea"("status","potentialScore");
CREATE INDEX "SocialIdea_movieId_idx" ON "SocialIdea"("movieId");

CREATE TABLE "SocialTemplate" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "systemPrompt" TEXT NOT NULL,
  "userPrompt" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SocialTemplate_name_key" ON "SocialTemplate"("name");

CREATE TABLE "SocialScheduleRule" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "postType" "SocialPostType" NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "publishHour" INTEGER NOT NULL,
  "publishMinute" INTEGER NOT NULL DEFAULT 0,
  "dailyLimit" INTEGER NOT NULL DEFAULT 1,
  "minimumGapMin" INTEGER NOT NULL DEFAULT 60,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SocialScheduleRule_isActive_postType_idx" ON "SocialScheduleRule"("isActive","postType");

CREATE TABLE "SocialPublishJob" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT,
  "type" "SocialJobType" NOT NULL,
  "provider" "SocialProvider",
  "status" "SocialJobStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "heartbeatAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB,
  "result" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPublishJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "SocialPublishJob_idempotencyKey_key" ON "SocialPublishJob"("idempotencyKey");
CREATE INDEX "SocialPublishJob_status_scheduledAt_priority_idx" ON "SocialPublishJob"("status","scheduledAt","priority");
CREATE INDEX "SocialPublishJob_leaseExpiresAt_idx" ON "SocialPublishJob"("leaseExpiresAt");
CREATE INDEX "SocialPublishJob_postId_idx" ON "SocialPublishJob"("postId");

CREATE TABLE "SocialPublishAttempt" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "SocialJobStatus" NOT NULL,
  "requestType" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "externalResponse" JSONB,
  CONSTRAINT "SocialPublishAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SocialPublishJob"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "SocialPublishAttempt_jobId_attemptNumber_key" ON "SocialPublishAttempt"("jobId","attemptNumber");
CREATE INDEX "SocialPublishAttempt_jobId_startedAt_idx" ON "SocialPublishAttempt"("jobId","startedAt");

CREATE TABLE "SocialMetricSnapshot" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "views" INTEGER,
  "likes" INTEGER,
  "comments" INTEGER,
  "reposts" INTEGER,
  "clicks" INTEGER,
  "watchTimeMs" BIGINT,
  "completionRate" DOUBLE PRECISION,
  "raw" JSONB,
  CONSTRAINT "SocialMetricSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE
);
CREATE INDEX "SocialMetricSnapshot_postId_capturedAt_idx" ON "SocialMetricSnapshot"("postId","capturedAt");

CREATE TABLE "SocialAiUsage" (
  "id" TEXT PRIMARY KEY,
  "operation" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(18,8),
  "requestId" TEXT,
  "postId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SocialAiUsage_createdAt_idx" ON "SocialAiUsage"("createdAt");
CREATE INDEX "SocialAiUsage_postId_idx" ON "SocialAiUsage"("postId");

CREATE TABLE "SocialAuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "actor" TEXT,
  "ipHash" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SocialAuditLog_entityType_entityId_idx" ON "SocialAuditLog"("entityType","entityId");
CREATE INDEX "SocialAuditLog_createdAt_idx" ON "SocialAuditLog"("createdAt");

CREATE TABLE "SocialTrackingClick" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "postId" TEXT,
  "path" TEXT,
  "referer" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SocialTrackingClick_code_createdAt_idx" ON "SocialTrackingClick"("code","createdAt");
CREATE INDEX "SocialTrackingClick_postId_createdAt_idx" ON "SocialTrackingClick"("postId","createdAt");

INSERT INTO "SocialTemplate" ("id","name","category","systemPrompt","userPrompt","updatedAt") VALUES
('social_tpl_why','Почему…','Факты','Не выдумывай факты. Пиши живо и точно.','Объясни, почему произошло событие, опираясь только на источники.',CURRENT_TIMESTAMP),
('social_tpl_how_filmed','Как снимали…','Закулисье','Не выдумывай факты. Пиши живо и точно.','Расскажи о съёмочном процессе с подтверждёнными деталями.',CURRENT_TIMESTAMP),
('social_tpl_deleted','Удалённая сцена','Закулисье','Не выдумывай факты. Пиши живо и точно.','Расскажи об удалённой сцене и причинах её исключения.',CURRENT_TIMESTAMP),
('social_tpl_science','Научная точность','Разбор','Не выдумывай факты. Пиши живо и точно.','Разбери научную достоверность фильма.',CURRENT_TIMESTAMP);
