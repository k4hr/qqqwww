import { prisma } from "@/lib/prisma";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { recalculateAllHomeScores } from "@/lib/trend-engine";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL не указан.");
  const catalog = await recalculateAllCatalogScores();
  const home = await recalculateAllHomeScores();
  console.log(JSON.stringify({ catalog, home }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
