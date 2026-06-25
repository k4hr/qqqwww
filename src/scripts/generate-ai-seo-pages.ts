import { generateTopAiSeoLandingPages } from "@/lib/seo/ai-builder";

async function main() {
  const limit = Number(process.env.SEO_AI_LIMIT ?? process.argv[2] ?? 10);
  const result = await generateTopAiSeoLandingPages(Number.isFinite(limit) ? limit : 10);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
