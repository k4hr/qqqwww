DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MovieArtworkType') THEN
    CREATE TYPE "MovieArtworkType" AS ENUM ('BACKDROP', 'POSTER', 'LOGO');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "MovieArtwork" (
  "id" TEXT NOT NULL,
  "movieId" TEXT NOT NULL,
  "type" "MovieArtworkType" NOT NULL,
  "source" TEXT NOT NULL,
  "filePath" TEXT,
  "url" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "aspectRatio" DOUBLE PRECISION,
  "language" TEXT,
  "voteAverage" DOUBLE PRECISION,
  "voteCount" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MovieArtwork_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MovieArtwork_movieId_type_url_key" ON "MovieArtwork"("movieId", "type", "url");
CREATE INDEX IF NOT EXISTS "MovieArtwork_movieId_type_isPrimary_sortOrder_idx" ON "MovieArtwork"("movieId", "type", "isPrimary", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MovieArtwork_movieId_fkey'
  ) THEN
    ALTER TABLE "MovieArtwork"
      ADD CONSTRAINT "MovieArtwork_movieId_fkey"
      FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
