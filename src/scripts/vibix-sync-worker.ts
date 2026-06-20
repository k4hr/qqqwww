import { prisma } from "../lib/prisma";
import { sleep } from "../lib/vibix";
import { processVibixSyncJob } from "../lib/vibix-sync-job";

async function runWorker() {
  console.info("[VibixWorker] Started");
  while (true) {
    try {
      const job = await prisma.vibixSyncJob.findFirst({
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        orderBy: { createdAt: "asc" },
      });
      if (job) await processVibixSyncJob(job.id);
      else await sleep(10_000);
    } catch (error) {
      console.error("[VibixWorker] Loop error:", error instanceof Error ? error.message : error);
      await sleep(10_000);
    }
  }
}

runWorker().finally(async () => prisma.$disconnect());
