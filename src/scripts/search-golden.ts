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

  const movies = await searchMovies(testCase.query, {}, 8);
  if (!movies.length) {
    return {
      query: testCase.query,
      normalized: normalizeSearchQuery(testCase.query),
      parsed,
      routeIntent,
      topResults: [],
      topProvenance: [],
      status: "SKIP",
      reason: "No local DB result for this query.",
      durationMs: Date.now() - startedAt,
    };
  }

  const top = movies[0];
  const explanation = explainSearchResult(top, testCase.query);
  const expectedExists = testCase.expectTitle
    ? await prisma.movie.findFirst({
      where: {
        OR: [
          { titleRu: { contains: testCase.expectTitle, mode: "insensitive" } },
          { titleOriginal: { contains: testCase.expectTitle, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })
    : null;
  const titlePassed = testCase.expectTitle ? includesTitle(`${top.titleRu} ${top.titleOriginal ?? ""}`, testCase.expectTitle) : true;
  const seasonPassed = testCase.expectSeason ? parsed.season?.season === testCase.expectSeason : true;

  return {
    query: testCase.query,
    normalized: normalizeSearchQuery(testCase.query),
    parsed,
    routeIntent,
    topResults: movies.map((movie) => ({
      title: movie.titleRu,
      originalTitle: movie.titleOriginal,
      year: movie.year,
      type: movie.type,
      score: explainSearchResult(movie, testCase.query).score,
      provenance: explainSearchResult(movie, testCase.query).provenance,
    })),
    topProvenance: explanation.provenance,
    status: expectedExists || !testCase.expectTitle ? (titlePassed && seasonPassed ? "PASS" : "FAIL") : "SKIP",
    reason: expectedExists ? undefined : "Expected title is not present in local DB.",
    durationMs: Date.now() - startedAt,
  };
}

async function main() {
  const results = [];

  const idMovie = await prisma.movie.findFirst({
    where: { OR: [{ imdbId: { not: null } }, { kinopoiskId: { not: null } }] },
    select: { titleRu: true, imdbId: true, kinopoiskId: true },
    orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }],
  });
  const cases = [...CASES];
  if (idMovie?.imdbId) cases.push({ query: idMovie.imdbId, expectTitle: idMovie.titleRu, kind: "id" });
  if (idMovie?.kinopoiskId) cases.push({ query: idMovie.kinopoiskId, expectTitle: idMovie.titleRu, kind: "id" });

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
