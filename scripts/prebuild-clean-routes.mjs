import { existsSync } from "node:fs";
import { join } from "node:path";

const staleRoutes = [
  join(process.cwd(), "src", "app", "series", "[slug]"),
];

for (const route of staleRoutes) {
  if (existsSync(route)) {
    console.error(`[prebuild-clean-routes] stale source route exists and must be resolved explicitly: ${route}`);
    console.error("[prebuild-clean-routes] Build scripts must not mutate the git worktree.");
    process.exitCode = 1;
  }
}
