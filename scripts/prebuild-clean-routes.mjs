import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const staleRoutes = [
  join(process.cwd(), "src", "app", "series", "[slug]"),
];

for (const route of staleRoutes) {
  if (existsSync(route)) {
    rmSync(route, { recursive: true, force: true });
    console.log(`[prebuild-clean-routes] removed stale route: ${route}`);
  }
}
