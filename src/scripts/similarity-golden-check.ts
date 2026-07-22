import { prisma } from "@/lib/prisma";
import { findSimilarSeoMovies, getSeoMovieBySlug, movieSeoInclude, type SeoMovie } from "@/lib/seo-pages";
import { normalizeSearchQuery } from "@/lib/search";
import { buildSimilarityProfile } from "@/lib/similarity/similarity-profile";
import { calculateSimilarityScore, SIMILARITY_ALGORITHM_VERSION } from "@/lib/similarity/similarity-score";

type GoldenCase = {
  title: string;
  mustInclude?: string[];
  shouldInclude?: string[];
  mustExclude?: string[];
};

const CASES: GoldenCase[] = [
  { title: "Извне", shouldInclude: ["Ходячие мертвецы"], mustExclude: ["Один дома"] },
  { title: "Интерстеллар", shouldInclude: ["Начало"], mustExclude: ["Шрэк"] },
  { title: "Шрэк", shouldInclude: ["Шрэк 2"], mustExclude: ["Заклятие"] },
  { title: "Пчеловод", shouldInclude: ["Джон Уик"], mustExclude: ["Один дома"] },
  { title: "Ходячие мертвецы", shouldInclude: ["Извне"], mustExclude: ["Шрэк"] },
  { title: "Игра престолов", shouldInclude: ["Дом дракона"], mustExclude: ["Форсаж"] },
  { title: "Гарри Поттер", shouldInclude: ["Фантастические твари"], mustExclude: ["Пчеловод"] },
  { title: "Железный человек", shouldInclude: ["Мстители"], mustExclude: ["Один дома"] },
  { title: "Остров проклятых", shouldInclude: ["Начало"], mustExclude: ["Шрэк"] },
  { title: "Один дома", shouldInclude: ["Один дома 2"], mustExclude: ["Заклятие"] },
  { title: "Заклятие", shouldInclude: ["Астрал"], mustExclude: ["Шрэк"] },
  { title: "Джон Уик", shouldInclude: ["Джон Уик 2"], mustExclude: ["Шрэк"] },
];

const MIN_PRECISION_AT_6 = 0.35;
const MIN_PRECISION_AT_12 = 0.5;
const MAX_TYPE_MISMATCH_RATE = 0;
const MAX_BROAD_GENRE_ONLY_RATE = 0.2;
const MAX_EMPTY_RESULT_RATE = 0.25;

function titleKey(value: string) {
  return normalizeSearchQuery(value).replace(/\s+/g, " ");
}

async function findMovieByTitle(title: string): Promise<SeoMovie | null> {
  const exact = await prisma.movie.findFirst({
    where: {
      AND: [
        { OR: [{ titleRu: { equals: title, mode: "insensitive" } }, { titleOriginal: { equals: title, mode: "insensitive" } }] },
        { isPublicVisible: true },
      ],
    },
    include: movieSeoInclude,
    orderBy: [{ kpRating: "desc" }, { year: "asc" }],
  });
  if (exact) return getSeoMovieBySlug(exact.slug);

  const direct = await prisma.movie.findFirst({
    where: { OR: [{ titleRu: { contains: title, mode: "insensitive" } }, { titleOriginal: { contains: title, mode: "insensitive" } }] },
    include: movieSeoInclude,
    orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }, { year: "asc" }],
  });
  return direct ? getSeoMovieBySlug(direct.slug) : null;
}

function hasTitle(results: SeoMovie[], expected: string, limit = results.length) {
  const expectedKey = titleKey(expected);
  return results.slice(0, limit).some((movie) => titleKey(`${movie.titleRu} ${movie.titleOriginal ?? ""}`).includes(expectedKey));
}

function duplicateFranchiseCount(source: SeoMovie, results: SeoMovie[]) {
  const counts = new Map<string, number>();
  for (const movie of results) {
    const key = buildSimilarityProfile(movie).baseTitle;
    if (!key || key === buildSimilarityProfile(source).baseTitle) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 4).length;
}

async function main() {
  const startedAt = Date.now();
  let evaluated = 0;
  let skipped = 0;
  let passed = 0;
  let failed = 0;
  let includeHitsAt6 = 0;
  let includeHitsAt12 = 0;
  let includeTotal = 0;
  let excludeViolations = 0;
  let emptyResults = 0;
  let typeMismatches = 0;
  let broadGenreOnly = 0;
  let duplicateFranchise = 0;
  let strongSignalTotal = 0;
  let scoredResults = 0;
  let returnedResults = 0;

  console.log(`[similarity:golden] algorithmVersion=${SIMILARITY_ALGORITHM_VERSION}`);

  for (const entry of CASES) {
    const source = await findMovieByTitle(entry.title);
    if (!source) {
      skipped += 1;
      console.log(`SKIP: source title not found: ${entry.title}`);
      continue;
    }

    const sourceProfile = buildSimilarityProfile(source);
    const results = await findSimilarSeoMovies(source, 12);
    evaluated += 1;
    if (!results.length) emptyResults += 1;
    typeMismatches += results.filter((item) => item.type !== source.type).length;
    returnedResults += results.length;
    duplicateFranchise += duplicateFranchiseCount(source, results);

    const expectedTitles = [...(entry.mustInclude ?? []), ...(entry.shouldInclude ?? [])];
    for (const expected of expectedTitles) {
      includeTotal += 1;
      if (hasTitle(results, expected, 6)) includeHitsAt6 += 1;
      if (hasTitle(results, expected, 12)) includeHitsAt12 += 1;
    }

    for (const forbidden of entry.mustExclude ?? []) {
      if (hasTitle(results, forbidden, 12)) excludeViolations += 1;
    }

    console.log(`\nSource: ${source.titleRu}`);
    console.log("Top 6:");
    results.slice(0, 6).forEach((movie, index) => {
      const score = calculateSimilarityScore(source, movie, sourceProfile, buildSimilarityProfile(movie));
      strongSignalTotal += score.strongSignals;
      scoredResults += 1;
      if (score.penalties.includes("broad_genre_only") || score.penalties.includes("weak_metadata_only")) broadGenreOnly += 1;
      console.log(`${index + 1}. ${movie.titleRu} (${movie.year}) [${movie.type}] score=${score.score} bucket=${score.bucket}`);
      console.log(`   Reasons: ${score.reasons.join("; ")}`);
      console.log(`   Sources: ${(movie.similaritySources ?? []).join(", ") || "runtime"}`);
    });
    const pass = expectedTitles.every((title) => hasTitle(results, title, 12)) && (entry.mustExclude ?? []).every((title) => !hasTitle(results, title, 12));
    if (pass) passed += 1;
    else failed += 1;
    console.log(pass ? "PASS" : "FAIL");
  }

  const summary = {
    evaluated,
    passed,
    failed,
    skipped,
    precisionAt6: includeTotal ? Number((includeHitsAt6 / includeTotal).toFixed(3)) : null,
    precisionAt12: includeTotal ? Number((includeHitsAt12 / includeTotal).toFixed(3)) : null,
    typeMismatchRate: returnedResults ? Number((typeMismatches / returnedResults).toFixed(3)) : null,
    broadGenreOnlyRate: scoredResults ? Number((broadGenreOnly / scoredResults).toFixed(3)) : null,
    emptyResultRate: evaluated ? Number((emptyResults / evaluated).toFixed(3)) : null,
    duplicateFranchiseRate: evaluated ? Number((duplicateFranchise / evaluated).toFixed(3)) : null,
    averageStrongSignalCount: scoredResults ? Number((strongSignalTotal / scoredResults).toFixed(2)) : null,
    mustIncludeHits: includeHitsAt12,
    mustIncludeTotal: includeTotal,
    mustExcludeViolations: excludeViolations,
    durationMs: Date.now() - startedAt,
  };

  console.log("\n[similarity:golden] summary");
  console.log(JSON.stringify(summary, null, 2));
  const violations: string[] = [];
  if (evaluated === 0) violations.push("no golden cases were evaluated");
  if (failed > 0) violations.push(`${failed} evaluated case(s) failed`);
  if (summary.precisionAt6 !== null && summary.precisionAt6 < MIN_PRECISION_AT_6) violations.push(`Precision@6 ${summary.precisionAt6} < ${MIN_PRECISION_AT_6}`);
  if (summary.precisionAt12 !== null && summary.precisionAt12 < MIN_PRECISION_AT_12) violations.push(`Precision@12 ${summary.precisionAt12} < ${MIN_PRECISION_AT_12}`);
  if (summary.typeMismatchRate !== null && summary.typeMismatchRate > MAX_TYPE_MISMATCH_RATE) violations.push(`typeMismatchRate ${summary.typeMismatchRate} > ${MAX_TYPE_MISMATCH_RATE}`);
  if (summary.broadGenreOnlyRate !== null && summary.broadGenreOnlyRate > MAX_BROAD_GENRE_ONLY_RATE) violations.push(`broadGenreOnlyRate ${summary.broadGenreOnlyRate} > ${MAX_BROAD_GENRE_ONLY_RATE}`);
  if (summary.emptyResultRate !== null && summary.emptyResultRate > MAX_EMPTY_RESULT_RATE) violations.push(`emptyResultRate ${summary.emptyResultRate} > ${MAX_EMPTY_RESULT_RATE}`);
  if (excludeViolations > 0) violations.push(`${excludeViolations} mustExclude violation(s)`);
  if (violations.length) {
    console.error("[similarity:golden] FAIL thresholds", violations);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
