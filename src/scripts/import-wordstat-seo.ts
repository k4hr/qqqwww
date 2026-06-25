import fs from "node:fs/promises";
import path from "node:path";
import { importWordstatKeywords } from "@/lib/seo/keyword-engine";

async function main() {
  const dir = path.join(process.cwd(), "src", "data", "wordstat");
  const files = (await fs.readdir(dir).catch(() => [])).filter((file) => file.endsWith(".csv"));
  let totalRows = 0;
  let totalClusters = 0;
  let totalPages = 0;
  for (const file of files) {
    const text = await fs.readFile(path.join(dir, file), "utf8");
    const result = await importWordstatKeywords(text, `wordstat:${file}`);
    totalRows += result.rows;
    totalClusters += result.clusters;
    totalPages += result.pages;
    console.log(`[seo:wordstat] ${file}:`, result);
  }
  console.log(`[seo:wordstat] done files=${files.length}; rows=${totalRows}; clusters=${totalClusters}; pages=${totalPages}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
