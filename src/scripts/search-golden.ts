import { prisma } from "@/lib/prisma";
import { explainSearchResult, normalizeSearchQuery, searchMovies } from "@/lib/search";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";
import { parseSearchIntent } from "@/lib/search-v2";

type Case = {
  query: string;
  expectTitle?: string;
  expectRoute?: string;
  expectSeason?: number;
  kind?: "movie" | "route" | "id";
};

const CASES: Case[] = [
  { query: "Iron Man", expectTitle: "Железный человек" },
  { query: "iron man", expectTitle: "Железный человек" },
  { query: "Iron-Man", expectTitle: "Железный человек" },
  { query: "IronMan", expectTitle: "Железный человек" },
  { query: "Железный человек", expectTitle: "Железный человек" },
  { query: "Железний человек", expectTitle: "Железный человек" },
  { query: "zhelezny chelovek", expectTitle: "Железный человек" },
  { query: "Spider Man", expectTitle: "Человек-паук" },
  { query: "Человек паук", expectTitle: "Человек-паук" },
  { query: "Елки", expectTitle: "Ёлки" },
  { query: "Ёлки", expectTitle: "Ёлки" },
  { query: "From", expectTitle: "Извне" },
  { query: "Извне", expectTitle: "Извне" },
  { query: "Извне 4 сезон", expectTitle: "Извне", expectSeason: 4 },
  { query: "Извне сезон 4", expectTitle: "Извне", expectSeason: 4 },
  { query: "From S4", expectTitle: "Извне", expectSeason: 4 },
  { query: "смотреть Извне 4 сезон", expectTitle: "Извне", expectSeason: 4 },
  { query: "смотреть аниме", expectRoute: "/anime", kind: "route" },
  { query: "смотреть сериалы", expectRoute: "/series", kind: "route" },
  { query: "смотреть фильм", expectRoute: "/films", kind: "route" },
  { query: "фильм Iron Man", expectTitle: "Железный человек" },
  { query: "аниме Наруто", expectTitle: "Наруто" },
  { query: "Интерстелар", expectTitle: "Интерстеллар" },
  { query: "Интерселлар", expectTitle: "Интерстеллар" },
  { query: "Гари Потер", expectTitle: "Гарри Поттер" },
  { query: "Челвоек паук", expectTitle: "Человек-паук" },
  { query: "Ходячие мертвци", expectTitle: "Ходячие мертвецы" },
];

function includesTitle(value: string, expected: string) {
  const normalized = normalizeSearchQuery(value);
  const expectedNormalized = normalizeSearchQuery(expected);
  return normalized.includes(expectedNormalized) || expectedNormalized.includes(normalized);
}

async function runCase(testCase: Case) {
  const startedAt = Date.now();
  const parsed = parseSearchIntent(testCase.query);
  const routeIntent = resolveSearchRedirectPath(testCase.query);

  if (testCase.expectRoute) {
    const passed = routeIntent?.href.startsWith(testCase.expectRoute) ?? false;
    return {
      query: testCase.query,
      normalized: normalizeSearchQuery(testCase.query),
      parsed,
      routeIntent,
      topResults: [],
      topProvenance: [],
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - startedAt,
    };
  }

  const expectedExists = testCase.expectTitle
    ? await prisma.movie.findFirst({
      where: {
        OR: [
          { titleRu: { contains: testCase.expectTitle, mode: "insensitive" } },
          { titleOriginal: { contains: testCase.expectTitle, mode: "insensitive" } },
        ],
      },
      select: { id: true, titleRu: true },
    })
    : null;

  if (testCase.expectTitle && !expectedExists) {
    return {
      query: testCase.query,
      normalized: normalizeSearchQuery(testCase.query),
      parsed,
      routeIntent,
      expectedExists: false,
      candidateCount: 0,
      topResult: null,
      topProvenance: [],
      status: "SKIP",
      reason: "Expected title is not present in local DB.",
      durationMs: Date.now() - startedAt,
    };
  }

  const movies = await searchMovies(testCase.query, {}, 12, "FULL");
  if (!movies.length) {
    return {
      query: testCase.query,
      normalized: normalizeSearchQuery(testCase.query),
      intent: parsed,
      expectedExists: Boolean(expectedExists),
      candidateCount: 0,
      topResult: null,
      topProvenance: [],
      position: -1,
      status: "FAIL",
      reason: "Expected movie exists, but DB retrieval returned no candidates.",
      durationMs: Date.now() - startedAt,
    };
  }

  const top = movies[0];
  const explanation = explainSearchResult(top, testCase.query);
  const position = testCase.expectTitle
    ? movies.findIndex((movie) => includesTitle(`${movie.titleRu} ${movie.titleOriginal ?? ""}`, testCase.expectTitle!))
    : 0;
  const titlePassed = position >= 0 && position <= 2;
  const seasonPassed = testCase.expectSeason ? parsed.season?.season === testCase.expectSeason : true;

  return {
    query: testCase.query,
    normalized: normalizeSearchQuery(testCase.query),
    intent: parsed,
    routeIntent,
    expectedExists: Boolean(expectedExists),
    candidateCount: movies.length,
    topResult: { title: top.titleRu, originalTitle: top.titleOriginal, year: top.year, type: top.type },
    topProvenance: explanation.provenance,
    position,
    status: titlePassed && seasonPassed ? "PASS" : "FAIL",
    reason: !titlePassed ? `Expected result position ${position}; required 0..2.` : !seasonPassed ? "Season intent mismatch." : undefined,
    durationMs: Date.now() - startedAt,
  };
}

async function main() {
  const results = [];

  const [imdbMovie, kpCandidates] = await Promise.all([
    prisma.movie.findFirst({
      where: { imdbId: { startsWith: "tt" } },
      select: { titleRu: true, imdbId: true },
      orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }],
    }),
    prisma.movie.findMany({
      where: { kinopoiskId: { not: null } },
      select: { titleRu: true, kinopoiskId: true },
      orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }],
      take: 200,
    }),
  ]);
  const kpMovie = kpCandidates.find((movie) => /^\d+$/.test(movie.kinopoiskId ?? ""));
  const cases = [...CASES];
  if (imdbMovie?.imdbId) cases.push({ query: imdbMovie.imdbId, expectTitle: imdbMovie.titleRu, kind: "id" });
  if (kpMovie?.kinopoiskId) cases.push({ query: kpMovie.kinopoiskId, expectTitle: kpMovie.titleRu, kind: "id" });

  for (const testCase of cases) {
    try {
      const result = await runCase(testCase);
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const result = {
        query: testCase.query,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    }
  }

  const summary = {
    total: results.length,
    pass: results.filter((item) => item.status === "PASS").length,
    fail: results.filter((item) => item.status === "FAIL").length,
    skip: results.filter((item) => item.status === "SKIP").length,
    error: results.filter((item) => item.status === "ERROR").length,
  };
  console.log("[search:golden] summary", JSON.stringify(summary, null, 2));
  if (summary.fail > 0 || summary.error > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
