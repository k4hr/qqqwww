import { runVibixCatalogMagicWorkerLoop } from "@/lib/vibix-catalog/catalog-magic-sync";

runVibixCatalogMagicWorkerLoop().catch((error) => {
  console.error("[VibixCatalogWorker] Fatal error", error);
  process.exit(1);
});
