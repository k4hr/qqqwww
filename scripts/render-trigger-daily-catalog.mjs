const baseUrl = (process.env.REDFILM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!baseUrl) {
  console.error("[render-cron] REDFILM_BASE_URL / NEXT_PUBLIC_SITE_URL / SITE_URL is not configured.");
  process.exit(1);
}

if (!secret) {
  console.error("[render-cron] CRON_SECRET is not configured.");
  process.exit(1);
}

const url = `${baseUrl}/api/cron/daily-catalog?runOnce=1`;
console.log(`[render-cron] Triggering ${url}`);

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "user-agent": "redfilm-render-cron/1.0",
    },
  });
  const text = await response.text();
  console.log(`[render-cron] status=${response.status}`);
  console.log(text.slice(0, 4000));
  if (!response.ok) process.exit(1);
} catch (error) {
  console.error("[render-cron] failed", error);
  process.exit(1);
}
