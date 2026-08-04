import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  LINK_GENERATOR_BUCKET_META,
  LINK_GENERATOR_BUCKETS,
  LINK_GENERATOR_CONTENT_TYPES,
  type LinkGeneratorBucket,
  type LinkGeneratorBucketCounts,
  type LinkGeneratorContentType,
  type LinkGeneratorItem,
  type LinkGeneratorStats,
} from "@/lib/link-generator-types";

const SITE_ORIGIN = "https://www.redfilm.win";
const MAX_GENERATE_COUNT = 200;

type RawMovie = {
  id: string;
  slug: string;
  titleRu: string;
  type: LinkGeneratorContentType;
  duration: number;
};

function typeSql(types: LinkGeneratorContentType[]) {
  return Prisma.sql`"type" IN (${Prisma.join(types.map((type) => Prisma.sql`${type}::"ContentType"`))})`;
}

function bucketSql(bucket: LinkGeneratorBucket) {
  const { min, max } = LINK_GENERATOR_BUCKET_META[bucket];
  if (max === null) return Prisma.sql`"duration" >= ${min}`;
  return Prisma.sql`"duration" >= ${min} AND "duration" <= ${max}`;
}

function eligibleSql(types: LinkGeneratorContentType[]) {
  return Prisma.sql`
    "isPublished" = true
    AND "isCatalogAllowed" = true
    AND "vibixAvailable" = true
    AND "duration" IS NOT NULL
    AND "duration" > 0
    AND (
      NULLIF(BTRIM(COALESCE("vibixIframeUrl", '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE("vibixEmbedCode", '')), '') IS NOT NULL
    )
    AND ${typeSql(types)}
  `;
}

export function sanitizeContentTypes(input: unknown): LinkGeneratorContentType[] {
  if (!Array.isArray(input)) return [...LINK_GENERATOR_CONTENT_TYPES];
  const allowed = new Set<string>(LINK_GENERATOR_CONTENT_TYPES);
  const result = [...new Set(input.filter((value): value is LinkGeneratorContentType => typeof value === "string" && allowed.has(value)))];
  return result.length ? result : [...LINK_GENERATOR_CONTENT_TYPES];
}

export function sanitizeBucket(input: unknown): LinkGeneratorBucket | null {
  return typeof input === "string" && (LINK_GENERATOR_BUCKETS as readonly string[]).includes(input)
    ? (input as LinkGeneratorBucket)
    : null;
}

export function sanitizeCount(input: unknown, fallback: number) {
  const parsed = typeof input === "number" ? input : Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_GENERATE_COUNT, Math.max(1, Math.trunc(parsed)));
}

export function sanitizeMixedBucketCounts(input: unknown): LinkGeneratorBucketCounts {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const counts = {} as LinkGeneratorBucketCounts;

  for (const bucket of LINK_GENERATOR_BUCKETS) {
    const raw = source[bucket];
    const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "10"), 10);
    counts[bucket] = Number.isFinite(parsed)
      ? Math.min(40, Math.max(0, Math.trunc(parsed)))
      : 10;
  }

  return counts;
}

export class LinkGeneratorAvailabilityError extends Error {
  constructor(
    public readonly bucket: LinkGeneratorBucket,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`В диапазоне ${LINK_GENERATOR_BUCKET_META[bucket].title} найдено только ${available} из ${requested} запрошенных ссылок.`);
    this.name = "LinkGeneratorAvailabilityError";
  }
}

function toItem(movie: RawMovie): LinkGeneratorItem {
  return {
    id: movie.id,
    title: movie.titleRu,
    type: movie.type,
    duration: movie.duration,
    url: `${SITE_ORIGIN}/watch/${movie.slug}`,
  };
}

async function randomFromBucket(params: {
  bucket: LinkGeneratorBucket;
  types: LinkGeneratorContentType[];
  limit: number;
  excludeIds?: string[];
}) {
  const excludeIds = params.excludeIds ?? [];
  const excludeSql = excludeIds.length
    ? Prisma.sql`AND "id" NOT IN (${Prisma.join(excludeIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RawMovie[]>(Prisma.sql`
    SELECT "id", "slug", "titleRu", "type"::text AS "type", "duration"
    FROM "Movie"
    WHERE ${eligibleSql(params.types)}
      AND ${bucketSql(params.bucket)}
      ${excludeSql}
    ORDER BY random()
    LIMIT ${params.limit}
  `);

  return rows.map(toItem);
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function getLinkGeneratorStats(types: LinkGeneratorContentType[]): Promise<LinkGeneratorStats> {
  const rows = await prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>(Prisma.sql`
    SELECT
      CASE
        WHEN "duration" BETWEEN 1 AND 10 THEN 'MIN_1_10'
        WHEN "duration" BETWEEN 11 AND 30 THEN 'MIN_11_30'
        WHEN "duration" BETWEEN 31 AND 60 THEN 'MIN_31_60'
        WHEN "duration" >= 61 THEN 'MIN_61_PLUS'
        ELSE 'UNKNOWN'
      END AS "bucket",
      COUNT(*)::bigint AS "count"
    FROM "Movie"
    WHERE
      "isPublished" = true
      AND "isCatalogAllowed" = true
      AND "vibixAvailable" = true
      AND (
        NULLIF(BTRIM(COALESCE("vibixIframeUrl", '')), '') IS NOT NULL
        OR NULLIF(BTRIM(COALESCE("vibixEmbedCode", '')), '') IS NOT NULL
      )
      AND ${typeSql(types)}
    GROUP BY 1
  `);

  const stats: LinkGeneratorStats = {
    MIN_1_10: 0,
    MIN_11_30: 0,
    MIN_31_60: 0,
    MIN_61_PLUS: 0,
    UNKNOWN: 0,
  };

  for (const row of rows) {
    if (row.bucket in stats) stats[row.bucket as keyof LinkGeneratorStats] = Number(row.count);
  }

  return stats;
}

export async function generateBucketLinks(params: {
  bucket: LinkGeneratorBucket;
  types: LinkGeneratorContentType[];
  count: number;
}) {
  return randomFromBucket({
    bucket: params.bucket,
    types: params.types,
    limit: params.count,
  });
}

export async function generateMixedLinks(params: {
  types: LinkGeneratorContentType[];
  bucketCounts: LinkGeneratorBucketCounts;
}) {
  const selected: LinkGeneratorItem[] = [];

  for (const bucket of LINK_GENERATOR_BUCKETS) {
    const requested = params.bucketCounts[bucket];
    if (requested <= 0) continue;

    const items = await randomFromBucket({
      bucket,
      types: params.types,
      limit: requested,
      excludeIds: selected.map((item) => item.id),
    });

    if (items.length < requested) {
      throw new LinkGeneratorAvailabilityError(bucket, requested, items.length);
    }

    selected.push(...items);
  }

  return shuffle(selected);
}
