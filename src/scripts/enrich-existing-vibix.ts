import { enrichExistingVibixMovies } from "@/lib/trend-engine";

async function main() {
  const batchSize = Number(process.env.TREND_ENRICH_BATCH_SIZE || process.argv[2] || 100);
  const result = await enrichExistingVibixMovies({ batchSize });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
