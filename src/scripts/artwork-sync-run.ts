import { continueArtworkSyncState, getArtworkSyncState, startArtworkSyncState } from "@/lib/movie-artwork";

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function main() {
  const maxBatches = envInt("ARTWORK_SYNC_MAX_BATCHES", 20, 1, 500);
  const batchSize = envInt("ARTWORK_SYNC_BATCH_SIZE", 25, 1, 100);
  const concurrency = envInt("ARTWORK_SYNC_CONCURRENCY", 2, 1, 2);
  const restart = process.env.ARTWORK_SYNC_RESTART === "true";

  let state = await getArtworkSyncState();
  if (restart || state.status === "IDLE" || state.status === "COMPLETED") {
    const started = await startArtworkSyncState({ limit: batchSize, concurrency });
    console.log(JSON.stringify({ batch: 1, ...started }, null, 2));
    state = started.state;
  }

  for (let batch = 2; batch <= maxBatches && state.status === "RUNNING"; batch += 1) {
    const result = await continueArtworkSyncState();
    console.log(JSON.stringify({ batch, ...result }, null, 2));
    state = result.state;
    if (!result.ok || result.result?.disabled) break;
  }

  console.log(JSON.stringify({ done: true, state }, null, 2));
}

main().catch((error) => {
  console.error("[ArtworkSyncRun] Fatal error", error);
  process.exit(1);
});
