import { prisma } from "@/lib/prisma";
import { findSimilarSeoMovies, getSeoMovieBySlug, movieSeoInclude, type SeoMovie } from "@/lib/seo-pages";
import { normalizeSearchQuery } from "@/lib/search";

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

function titleKey(value: string) {
  return normalizeSearchQuery(value).replace(/\s+/g, " ");
}

async function findMovieByTitle(title: string): Promise<SeoMovie | null> {
  const direct = await prisma.movie.findFirst({
    where: { OR: [{ titleRu: { contains: title, mode: "insensitive" } }, { titleOriginal: { contains: title, mode: "insensitive" } }] },
    include: movieSeoInclude,
    orderBy: [{ isPublicVisible: "desc" }, { kpRating: "desc" }, { year: "asc" }],
  });
  return direct ? getSeoMovieBySlug(direct.slug) : null;
}

function hasTitle(results: SeoMovie[], expected: string) {
  const expectedKey = titleKey(expected);
  return results.some((movie) => titleKey(`${movie.titleRu} ${movie.titleOriginal ?? ""}`).includes(expectedKey));
}

async function main() {
  let evaluated = 0;
  let includeHits = 0;
  let includeTotal = 0;
  let excludeViolations = 0;
  let emptyResults = 0;
  let typeMismatches = 0;

  for (const entry of CASES) {
    const source = await findMovieByTitle(entry.title);
    if (!source) {
      console.log(`[skip] ${entry.title}: not found in DB`);
      continue;
    }

    const results = await findSimilarSeoMovies(source, 12);
    evaluated += 1;
    if (!results.length) emptyResults += 1;
    typeMismatches += results.filter((item) => item.type !== source.type).length;

    for (const expected of [...(entry.mustInclude ?? []), ...(entry.shouldInclude ?? [])]) {
      includeTotal += 1;
      if (hasTitle(results, expected)) includeHits += 1;
    }

    for (const forbidden of entry.mustExclude ?? []) {
      if (hasTitle(results, forbidden)) excludeViolations += 1;
    }

    console.log(`[case] ${entry.title}: ${results.map((item) => item.titleRu).join(" | ") || "empty"}`);
  }

  console.log(JSON.stringify({
    evaluated,
    skipped: CASES.length - evaluated,
    precisionAt12Approx: includeTotal ? Number((includeHits / includeTotal).toFixed(3)) : null,
    includeHits,
    includeTotal,
    excludeViolations,
    emptyResultRate: evaluated ? Number((emptyResults / evaluated).toFixed(3)) : null,
    typeMismatchRate: evaluated ? Number((typeMismatches / Math.max(1, evaluated * 12)).toFixed(3)) : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
