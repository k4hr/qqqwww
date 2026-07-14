import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SDK_URL = "https://graphicslab.io/sdk/v2/rendex-sdk.min.js";
const destination = resolve(process.cwd(), "public/vendor/rendex-sdk.min.js");
const temporary = `${destination}.tmp`;
const minimumSizeBytes = 10_000;
const attempts = 4;

async function downloadSdk() {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const response = await fetch(SDK_URL, {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": "REDFILM-build/1.0",
          accept: "application/javascript,text/javascript,*/*;q=0.1",
        },
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < minimumSizeBytes) {
        throw new Error(`SDK file is suspiciously small: ${bytes.byteLength} bytes`);
      }

      await mkdir(dirname(destination), { recursive: true });
      await writeFile(temporary, bytes);
      await rename(temporary, destination);

      const result = await stat(destination);
      console.log(`[Rendex SDK] Downloaded ${result.size} bytes to ${destination}`);
      return;
    } catch (error) {
      lastError = error;
      await rm(temporary, { force: true });

      if (attempt < attempts) {
        const delay = attempt * 2_000;
        console.warn(
          `[Rendex SDK] Attempt ${attempt}/${attempts} failed: ${
            error instanceof Error ? error.message : String(error)
          }. Retrying in ${delay}ms...`,
        );
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
      }
    }
  }

  throw new Error(
    `[Rendex SDK] Download failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

await downloadSdk();
