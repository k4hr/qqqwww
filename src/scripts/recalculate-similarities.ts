import { createSimilarityJob, processSimilarityJobBatch } from "@/lib/similarity/similarity-job";

async function main() {
  const mode = process.env.SIMILARITY_RECALCULATE_MODE === "dirty" ? "DIRTY" : "ALL";
  const batchSize = process.env.SIMILARITY_RECALCULATE_BATCH_SIZE ? Number(process.env.SIMILARITY_RECALCULATE_BATCH_SIZE) : 100;
  const targetLimit = process.env.SIMILARITY_TARGET_LIMIT ? Number(process.env.SIMILARITY_TARGET_LIMIT) : 24;

  const created = await createSimilarityJob({ mode, batchSize, targetLimit, force: true });
  console.log("[Similarity] job", JSON.stringify(created, null, 2));

  while (true) {
    const result = await processSimilarityJobBatch();
    console.log("[Similarity] batch", JSON.stringify(result, null, 2));
    const typedResult = result as { idle?: boolean; completed?: boolean; ok?: boolean };
    if (typedResult.idle || typedResult.completed || typedResult.ok === false) break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
