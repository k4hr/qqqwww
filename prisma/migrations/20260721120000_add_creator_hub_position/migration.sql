ALTER TABLE "CreatorHub"
ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CreatorHub_isPublished_position_idx"
ON "CreatorHub" ("isPublished", "position");
