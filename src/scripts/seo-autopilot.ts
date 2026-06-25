import { runSeoAutopilot } from "@/lib/seo/autopilot";

async function main() {
  const aiLimit = Number(process.argv[2] ?? process.env.SEO_AUTOPILOT_AI_LIMIT ?? 5);
  const result = await runSeoAutopilot({ aiLimit: Number.isFinite(aiLimit) ? aiLimit : 5, rebuildWordstat: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
