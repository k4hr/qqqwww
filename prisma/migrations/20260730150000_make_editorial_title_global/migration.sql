ALTER TABLE "Movie"
  ADD COLUMN "editorialSourceTitleRu" TEXT,
  ADD COLUMN "editorialSourceSlug" TEXT,
  ADD COLUMN "editorialTitleLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MovieSlugRedirect" (
  "id" TEXT NOT NULL,
  "oldSlug" TEXT NOT NULL,
  "movieId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovieSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovieSlugRedirect_oldSlug_key" ON "MovieSlugRedirect"("oldSlug");
CREATE INDEX "MovieSlugRedirect_movieId_idx" ON "MovieSlugRedirect"("movieId");

ALTER TABLE "MovieSlugRedirect"
  ADD CONSTRAINT "MovieSlugRedirect_movieId_fkey"
  FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
