import { runSimilarityWorkerLoop } from "@/lib/similarity/similarity-job";

runSimilarityWorkerLoop().catch((error) => {
  console.error(error);
  process.exit(1);
});
