import { prisma } from "../lib/prisma";
import { runVibixFirstTrendBatch } from "../lib/trend-engine";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL не указан. Запустите команду в Railway или задайте локальную PostgreSQL connection string.");
  if (!process.env.VIBIX_API_KEY?.trim()) throw new Error("VIBIX_API_KEY не указан.");
  const result = await runVibixFirstTrendBatch({
    batchSize: Number(process.env.TREND_SYNC_BATCH_SIZE || 20),
    detailDelayMs: Number(process.env.TREND_VIBIX_DETAIL_DELAY_MS || 1_000),
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Vibix-first trend sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
