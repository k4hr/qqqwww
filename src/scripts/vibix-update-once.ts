import { prisma } from "@/lib/prisma";
import { runVibixUpdateWatcher } from "@/lib/vibix-update-watcher";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";

async function main() {
  const update = await runVibixUpdateWatcher();
  const catalog = await recalculateAllCatalogScores();
  console.log(JSON.stringify({ update, catalog }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
