CREATE TABLE IF NOT EXISTS "TelegramUser" (
  "id" TEXT NOT NULL,
  "telegramId" TEXT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "languageCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TelegramFavorite" (
  "id" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "movieId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TelegramWatchHistory" (
  "id" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "movieId" TEXT NOT NULL,
  "progressSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramWatchHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TelegramSearchLog" (
  "id" TEXT NOT NULL,
  "telegramUserId" TEXT,
  "query" TEXT NOT NULL,
  "normalizedQuery" TEXT,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramSearchLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramUser_telegramId_key" ON "TelegramUser"("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramFavorite_telegramUserId_movieId_key" ON "TelegramFavorite"("telegramUserId", "movieId");
CREATE INDEX IF NOT EXISTS "TelegramFavorite_telegramUserId_idx" ON "TelegramFavorite"("telegramUserId");
CREATE INDEX IF NOT EXISTS "TelegramFavorite_movieId_idx" ON "TelegramFavorite"("movieId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramWatchHistory_telegramUserId_movieId_key" ON "TelegramWatchHistory"("telegramUserId", "movieId");
CREATE INDEX IF NOT EXISTS "TelegramWatchHistory_telegramUserId_idx" ON "TelegramWatchHistory"("telegramUserId");
CREATE INDEX IF NOT EXISTS "TelegramWatchHistory_movieId_idx" ON "TelegramWatchHistory"("movieId");
CREATE INDEX IF NOT EXISTS "TelegramWatchHistory_lastWatchedAt_idx" ON "TelegramWatchHistory"("lastWatchedAt");
CREATE INDEX IF NOT EXISTS "TelegramSearchLog_telegramUserId_idx" ON "TelegramSearchLog"("telegramUserId");
CREATE INDEX IF NOT EXISTS "TelegramSearchLog_createdAt_idx" ON "TelegramSearchLog"("createdAt");

ALTER TABLE "TelegramFavorite" ADD CONSTRAINT "TelegramFavorite_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramFavorite" ADD CONSTRAINT "TelegramFavorite_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramWatchHistory" ADD CONSTRAINT "TelegramWatchHistory_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramWatchHistory" ADD CONSTRAINT "TelegramWatchHistory_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramSearchLog" ADD CONSTRAINT "TelegramSearchLog_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "TelegramUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
