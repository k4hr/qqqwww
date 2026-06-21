ALTER TABLE "Movie"
  ADD COLUMN "vibixUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "vibixTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "vibixVoiceovers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "vibixLgbtContent" INTEGER,
  ADD COLUMN "vibixSeasonCount" INTEGER,
  ADD COLUMN "vibixEpisodeCount" INTEGER;
