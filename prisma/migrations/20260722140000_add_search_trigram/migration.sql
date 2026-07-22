CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Movie_titleRu_trgm_idx"
  ON "Movie" USING GIN (lower("titleRu") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Movie_titleOriginal_trgm_idx"
  ON "Movie" USING GIN (lower("titleOriginal") gin_trgm_ops)
  WHERE "titleOriginal" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Movie_slug_trgm_idx"
  ON "Movie" USING GIN (lower("slug") gin_trgm_ops);
