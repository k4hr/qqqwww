import { recalculateMovieSimilarities } from "@/lib/similarity/recalculate-similarities";

async function main() {
  const limit = process.env.SIMILARITY_RECALCULATE_LIMIT ? Number(process.env.SIMILARITY_RECALCULATE_LIMIT) : 1000;
  const offset = process.env.SIMILARITY_RECALCULATE_OFFSET ? Number(process.env.SIMILARITY_RECALCULATE_OFFSET) : 0;
  const targetLimit = process.env.SIMILARITY_TARGET_LIMIT ? Number(process.env.SIMILARITY_TARGET_LIMIT) : 24;
  const result = await recalculateMovieSimilarities({ limit, offset, targetLimit });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
