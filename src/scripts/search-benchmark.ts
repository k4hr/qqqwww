import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { getTrigramSearchCandidateIds, normalizeSearchQuery, searchMovies, type SearchMode } from "@/lib/search";

const databaseUrl = process.env.DATABASE_URL ?? "";
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const allowedHost = parsedUrl && ["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname);
if (process.env.NODE_ENV === "production" || process.env.REDFILM_ALLOW_TEST_SEED !== "true" || !allowedHost) {
  throw new Error("search:benchmark requires NODE_ENV!=production, REDFILM_ALLOW_TEST_SEED=true and a localhost DATABASE_URL.");
}

const prisma = new PrismaClient();
const queries = ["iron man", "железный человек", "интерстелар", "интерселлар", "гари потер", "from", "ходячие мертвци"];
const targetRows = 30_000;

function percentile(values: number[], factor: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * factor) - 1))] ?? 0;
}

async function seedBenchmarkCatalog() {
  const current = await prisma.movie.count();
  if (current < targetRows) {
    const missing = targetRows - current;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Movie" (
        "id", "slug", "titleRu", "titleOriginal", "description", "year", "type",
        "posterUrl", "quality", "vibixAvailable", "vibixIframeUrl", "isCatalogAllowed",
        "isPublished", "createdAt", "updatedAt"
      )
      SELECT
        'search-bench-' || value::text,
        'search-bench-' || md5('slug-' || value::text),
        md5('ru-title-' || value::text) || ' ' || md5('ru-topic-' || (value % 997)::text),
        md5('original-title-' || value::text) || ' ' || md5('original-topic-' || (value % 991)::text),
        'Deterministic local search benchmark fixture',
        1980 + (value % 47),
        'MOVIE'::"ContentType",
        '/player-poster.webp',
        'WEB-DL',
        true,
        'https://player.local/' || value::text,
        true,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${missing}) AS value
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  const fixtures = [
    ["iron-man", "Железный человек", "Iron Man"],
    ["interstellar", "Интерстеллар", "Interstellar"],
    ["harry-potter", "Гарри Поттер", "Harry Potter"],
    ["from-series", "Извне", "From"],
    ["walking-dead", "Ходячие мертвецы", "The Walking Dead"],
  ];
  for (const [slug, titleRu, titleOriginal] of fixtures) {
    await prisma.movie.upsert({
      where: { slug: `search-bench-${slug}` },
      create: {
        id: `search-bench-golden-${slug}`,
        slug: `search-bench-${slug}`,
        titleRu,
        titleOriginal,
        description: "Golden search benchmark fixture",
        year: 2024,
        posterUrl: "/player-poster.webp",
        vibixAvailable: true,
        vibixIframeUrl: `https://player.local/${slug}`,
        isCatalogAllowed: true,
        isPublished: true,
        isPublicVisible: true,
        kpRating: 8,
        kpVotes: 100_000,
      },
      update: { titleRu, titleOriginal, isCatalogAllowed: true, isPublished: true, vibixAvailable: true, posterUrl: "/player-poster.webp", vibixIframeUrl: `https://player.local/${slug}` },
    });
  }
  await prisma.$executeRawUnsafe('ANALYZE "Movie"');
  return prisma.movie.count();
}

async function explainFuzzy(query: string) {
  const normalized = normalizeSearchQuery(query);
  const plan = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(Prisma.sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    WITH candidates AS MATERIALIZED (
      SELECT "id" FROM "Movie"
      WHERE "isPublished" = true
        AND "isCatalogAllowed" = true
        AND "vibixAvailable" = true
        AND "posterUrl" IS NOT NULL
        AND "posterUrl" <> ''
        AND (("vibixIframeUrl" IS NOT NULL AND "vibixIframeUrl" <> '') OR ("vibixEmbedCode" IS NOT NULL AND "vibixEmbedCode" <> ''))
        AND lower("titleRu") % ${normalized}
      UNION
      SELECT "id" FROM "Movie"
      WHERE "isPublished" = true
        AND "isCatalogAllowed" = true
        AND "vibixAvailable" = true
        AND "posterUrl" IS NOT NULL
        AND "posterUrl" <> ''
        AND (("vibixIframeUrl" IS NOT NULL AND "vibixIframeUrl" <> '') OR ("vibixEmbedCode" IS NOT NULL AND "vibixEmbedCode" <> ''))
        AND "titleOriginal" IS NOT NULL
        AND lower("titleOriginal") % ${normalized}
      UNION
      SELECT "id" FROM "Movie"
      WHERE "isPublished" = true
        AND "isCatalogAllowed" = true
        AND "vibixAvailable" = true
        AND "posterUrl" IS NOT NULL
        AND "posterUrl" <> ''
        AND (("vibixIframeUrl" IS NOT NULL AND "vibixIframeUrl" <> '') OR ("vibixEmbedCode" IS NOT NULL AND "vibixEmbedCode" <> ''))
        AND lower("slug") % ${normalized}
    )
    SELECT movie."id"
    FROM candidates
    JOIN "Movie" movie ON movie."id" = candidates."id"
    ORDER BY GREATEST(
      similarity(lower(movie."titleRu"), ${normalized}),
      similarity(lower(COALESCE(movie."titleOriginal", '')), ${normalized}),
      similarity(lower(movie."slug"), ${normalized})
    ) DESC
    LIMIT 100
  `);
  const lines = plan.map((item) => item["QUERY PLAN"]);
  const fullScan = lines.some((line) => /Seq Scan on "?Movie"?/i.test(line));
  const indexLines = lines.filter((line) => /Bitmap (?:Index|Heap) Scan|Index Scan|Planning Time|Execution Time|Buffers:/i.test(line));
  console.log(`\nEXPLAIN ${query}`);
  indexLines.forEach((line) => console.log(line));
  if (fullScan) throw new Error(`Full Seq Scan detected for fuzzy query: ${query}`);
  if (!indexLines.some((line) => /Movie_(?:titleRu|titleOriginal|slug)_trgm_idx/.test(line))) {
    throw new Error(`Trigram index was not used for fuzzy query: ${query}`);
  }
}

async function benchmarkMode(mode: SearchMode) {
  const allDurations: number[] = [];
  for (const query of queries) {
    await searchMovies(query, {}, mode === "SUGGEST" ? 8 : 48, mode);
    const durations: number[] = [];
    let resultCount = 0;
    let topResult = "—";
    const candidateCount = (await getTrigramSearchCandidateIds(query, 100)).length;
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      const results = await searchMovies(query, {}, mode === "SUGGEST" ? 8 : 48, mode);
      const duration = performance.now() - started;
      durations.push(duration);
      allDurations.push(duration);
      resultCount = results.length;
      topResult = results[0]?.titleRu ?? "—";
    }
    console.log(JSON.stringify({ query, mode, durationMs: Number(percentile(durations, 0.5).toFixed(1)), candidateCount, resultCount, topResult }));
  }
  console.log(JSON.stringify({ mode, p50Ms: Number(percentile(allDurations, 0.5).toFixed(1)), p95Ms: Number(percentile(allDurations, 0.95).toFixed(1)), samples: allDurations.length }));
}

async function main() {
  try {
    const rows = await seedBenchmarkCatalog();
    console.log(`Benchmark catalog rows: ${rows}`);
    for (const query of queries) await explainFuzzy(query);
    await benchmarkMode("SUGGEST");
    await benchmarkMode("FULL");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
