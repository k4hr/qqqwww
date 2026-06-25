import { importEmbeddedWordstatFiles } from "@/lib/seo/keyword-engine";

async function main() {
  const result = await importEmbeddedWordstatFiles({ replace: true });
  console.log("[seo:wordstat] rebuilt from embedded CSV:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
