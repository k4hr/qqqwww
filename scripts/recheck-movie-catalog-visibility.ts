import { prisma } from "../src/lib/prisma";
import { evaluateMovieCatalogVisibility } from "../src/lib/catalog-filters";

const batchSize = 100;

async function main() {
  let cursor: string | undefined;
  let processed = 0;
  let allowed = 0;
  let blocked = 0;

  while (true) {
    const movies = await prisma.movie.findMany({
      select: { id: true, country: true },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!movies.length) break;

    for (const movie of movies) {
      const visibility = evaluateMovieCatalogVisibility(movie);
      await prisma.movie.update({ where: { id: movie.id }, data: visibility });
      processed += 1;
      if (visibility.isCatalogAllowed) allowed += 1;
      else blocked += 1;
    }

    cursor = movies[movies.length - 1].id;
    console.info(`[REDFILM] catalog visibility checked ${processed}; allowed ${allowed}; blocked ${blocked}`);
  }

  console.info(`[REDFILM] catalog visibility complete; processed ${processed}; allowed ${allowed}; blocked ${blocked}`);
}

main()
  .catch((error) => {
    console.error("[REDFILM] catalog visibility failed", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
