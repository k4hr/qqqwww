import { prisma } from "../lib/prisma";
import { recalculateAllHomeScores } from "../lib/trend-engine";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL не указан. Запустите команду в Railway или задайте локальную PostgreSQL connection string.");
  const result = await recalculateAllHomeScores();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Trend score recalculation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
