import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { normalizeSearchQuery, searchMovies } from "@/lib/search";

const CASES = [
  ["Iron Man", "Железный человек"],
  ["Железний человек", "Железный человек"],
  ["Интерстелар", "Интерстеллар"],
  ["Интерселлар", "Интерстеллар"],
  ["Гари Потер", "Гарри Поттер"],
  ["Челвоек паук", "Человек-паук"],
  ["Ходячие мертвци", "Ходячие мертвецы"],
] as const;

async function main() {
  let passed = 0;
  for (const [query, expected] of CASES) {
    const expectedMovie = await prisma.movie.findFirst({ where: { titleRu: { contains: expected, mode: "insensitive" } }, select: { id: true } });
    assert.ok(expectedMovie, `Fixture movie missing: ${expected}`);
    const results = await searchMovies(query, {}, 8, "FULL");
    const position = results.findIndex((movie) => normalizeSearchQuery(movie.titleRu).includes(normalizeSearchQuery(expected)));
    assert.ok(position >= 0 && position <= 2, `${query}: expected ${expected} in top 3, got ${results.map((movie) => movie.titleRu).join(", ")}`);
    passed += 1;
    console.log(`PASS ${query} -> ${expected} (position ${position + 1})`);
  }
  console.log(`[search:integration] ${passed}/${CASES.length} PASS`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
