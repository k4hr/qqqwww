CREATE TABLE "AiMatchUsage" (
  "id" TEXT NOT NULL,
  "sessionIdHash" TEXT,
  "mode" TEXT NOT NULL,
  "model" TEXT,
  "requestId" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "intentLength" INTEGER NOT NULL DEFAULT 0,
  "fallbackReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMatchUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiMatchUsage_createdAt_idx" ON "AiMatchUsage"("createdAt");
CREATE INDEX "AiMatchUsage_mode_createdAt_idx" ON "AiMatchUsage"("mode", "createdAt");

CREATE TABLE "AiMatchConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "model" TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  "dailyBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "maxCandidates" INTEGER NOT NULL DEFAULT 60,
  "recommendations" INTEGER NOT NULL DEFAULT 24,
  "timeoutMs" INTEGER NOT NULL DEFAULT 12000,
  "inputPricePerM" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
  "outputPricePerM" DOUBLE PRECISION NOT NULL DEFAULT 1.6,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiMatchConfig_pkey" PRIMARY KEY ("id")
);
INSERT INTO "AiMatchConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
