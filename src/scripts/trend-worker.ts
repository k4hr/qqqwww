import { runTrendSync } from "../lib/trend-engine";

const enabled = process.env.TREND_SYNC_ENABLED !== "false";
const intervalMinutes = Math.max(5, Number(process.env.TREND_SYNC_INTERVAL_MINUTES || 720));

async function tick() {
  try {
    const run = await runTrendSync({ batchSize: Number(process.env.TREND_SYNC_BATCH_SIZE || 20) });
    console.log(`[trend-worker] ${run.status}: found=${run.candidatesFound}, imported=${run.imported}, missing=${run.notInVibix}, failed=${run.failed}`);
    if (run.status === "RATE_LIMITED") {
      const retryDelay = Math.max(60_000, Number(process.env.TREND_VIBIX_RETRY_DELAY_MS || 60_000));
      console.log(`[trend-worker] Vibix rate limited; retry in ${retryDelay}ms`);
      setTimeout(() => void tick(), retryDelay);
    }
  } catch (error) {
    console.error("[trend-worker] run failed", error instanceof Error ? error.message : error);
  }
}

async function main() {
  if (!enabled) {
    console.log("[trend-worker] disabled by TREND_SYNC_ENABLED");
    return;
  }
  console.log(`[trend-worker] started; interval=${intervalMinutes}m`);
  await tick();
  setInterval(() => void tick(), intervalMinutes * 60_000);
}

void main();
