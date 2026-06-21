import { runVibixUpdateWatcher } from "@/lib/vibix-update-watcher";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { sleep } from "@/lib/vibix";

const enabled = process.env.VIBIX_UPDATE_WATCHER_ENABLED !== "false";
const intervalMinutes = Math.max(5, Number(process.env.VIBIX_UPDATE_INTERVAL_MINUTES || 30));

async function runLoop() {
  console.log(`[REDFILM] Vibix update worker started. enabled=${enabled}, interval=${intervalMinutes}m`);
  while (enabled) {
    try {
      const update = await runVibixUpdateWatcher();
      const catalog = await recalculateAllCatalogScores();
      console.log(JSON.stringify({ update, catalog }));
    } catch (error) {
      console.error("[REDFILM] Vibix update worker error:", error instanceof Error ? error.message : error);
    }
    await sleep(intervalMinutes * 60_000);
  }
}

runLoop().catch((error) => {
  console.error(error);
  process.exit(1);
});
