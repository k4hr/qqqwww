export type SocialConfig = ReturnType<typeof getSocialConfig>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function integer(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

export function getSocialConfig() {
  return {
    timezone: process.env.SOCIAL_TIMEZONE?.trim() || "Europe/Moscow",
    workerPollMs: integer("SOCIAL_WORKER_POLL_MS", 5000),
    leaseSeconds: integer("SOCIAL_JOB_LEASE_SECONDS", 300),
    uploadTtlSeconds: integer("SOCIAL_UPLOAD_URL_TTL_SECONDS", 900),
    previewTtlSeconds: integer("SOCIAL_PREVIEW_URL_TTL_SECONDS", 600),
    maxImageBytes: integer("SOCIAL_MAX_IMAGE_BYTES", 25 * 1024 * 1024),
    maxVideoBytes: integer("SOCIAL_MAX_VIDEO_BYTES", 2 * 1024 * 1024 * 1024),
    openAiModel: process.env.SOCIAL_OPENAI_MODEL?.trim() || "gpt-5-mini",
    openAiDailyLimitUsd: Number(process.env.SOCIAL_OPENAI_DAILY_LIMIT_USD || 10),
    r2: {
      accountId: required("CLOUDFLARE_ACCOUNT_ID"),
      accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      bucket: required("CLOUDFLARE_R2_BUCKET"),
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT?.trim() || `https://${required("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    },
  };
}

export function socialConfigState() {
  const names = [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET",
    "SOCIAL_SECRET_ENCRYPTION_KEY",
    "OPENAI_API_KEY",
  ];
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name]?.trim())]));
}
