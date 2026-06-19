const VIBIX_API_URL = "https://vibix.org/api/v1/publisher/videos";

export type VibixVideo = {
  id: number | string | null;
  name: string | null;
  name_rus: string | null;
  name_eng: string | null;
  type: string | null;
  year: number | string | null;
  kp_id: number | string | null;
  imdb_id: number | string | null;
  iframe_url: string | null;
  poster_url: string | null;
  quality: string | null;
  uploaded_at: string | null;
};

export type VibixPaginationMeta = {
  currentPage: number | null;
  lastPage: number | null;
  perPage: number | null;
  total: number | null;
};

export type VibixVideoPage = {
  data: VibixVideo[];
  meta: VibixPaginationMeta | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
};

type VibixLinksParams = {
  page?: number;
  limit?: number;
};

let warnedAboutMissingKey = false;

type VibixFetchResult = {
  data: unknown | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey() {
  const key = process.env.VIBIX_API_KEY?.trim();
  if (!key && !warnedAboutMissingKey) {
    console.warn("[Vibix] VIBIX_API_KEY is not configured; Vibix requests are disabled.");
    warnedAboutMissingKey = true;
  }
  return key || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeVideo(value: unknown): VibixVideo | null {
  const record = asRecord(value);
  if (!record) return null;
  const video = {
    id: firstValue(record, "id") as number | string | null,
    name: firstValue(record, "name") as string | null,
    name_rus: firstValue(record, "name_rus", "nameRus") as string | null,
    name_eng: firstValue(record, "name_eng", "nameEng") as string | null,
    type: firstValue(record, "type") as string | null,
    year: firstValue(record, "year") as number | string | null,
    kp_id: firstValue(record, "kp_id", "kpId", "kinopoisk_id") as number | string | null,
    imdb_id: firstValue(record, "imdb_id", "imdbId") as number | string | null,
    iframe_url: firstValue(record, "iframe_url", "iframeUrl") as string | null,
    poster_url: firstValue(record, "poster_url", "posterUrl") as string | null,
    quality: firstValue(record, "quality") as string | null,
    uploaded_at: firstValue(record, "uploaded_at", "uploadedAt") as string | null,
  };
  return video.id !== null || video.name !== null || video.name_rus !== null || video.kp_id !== null || video.imdb_id !== null || video.iframe_url !== null
    ? video
    : null;
}

function extractSingle(payload: unknown): VibixVideo | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const video = extractSingle(item);
      if (video) return video;
    }
    return null;
  }
  const direct = normalizeVideo(payload);
  if (direct) return direct;
  const record = asRecord(payload);
  if (!record) return null;
  for (const key of ["data", "item", "result", "video", "link"]) {
    const video = extractSingle(record[key]);
    if (video) return video;
  }
  return null;
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ["data", "items", "results", "links", "videos"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (asRecord(value)) {
      const nested = extractItems(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function extractMeta(payload: unknown): VibixPaginationMeta | null {
  const record = asRecord(payload);
  if (!record) return null;
  const meta = asRecord(record.meta);
  if (meta) {
    return {
      currentPage: numberValue(firstValue(meta, "current_page", "currentPage")),
      lastPage: numberValue(firstValue(meta, "last_page", "lastPage")),
      perPage: numberValue(firstValue(meta, "per_page", "perPage")),
      total: numberValue(firstValue(meta, "total")),
    };
  }
  for (const key of ["data", "result"]) {
    const nested = extractMeta(record[key]);
    if (nested) return nested;
  }
  return null;
}

function retryAfterMilliseconds(response: Response, attempt: number) {
  const value = response.headers.get("retry-after")?.trim();
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return 30_000 * (attempt + 1);
}

async function fetchVibixJson(url: URL): Promise<VibixFetchResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true };

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 404) {
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: false };
      }

      if (response.status === 429) {
        const retryAfterMs = retryAfterMilliseconds(response, attempt);
        if (attempt === maxAttempts - 1) {
          console.warn(`[Vibix] Rate limit reached after ${maxAttempts} attempts.`);
          return { data: null, rateLimited: true, retryAfterMs, requestFailed: false };
        }
        console.warn(`[Vibix] HTTP 429. Retrying in ${Math.ceil(retryAfterMs / 1000)} seconds.`);
        await sleep(retryAfterMs);
        continue;
      }

      if (response.status >= 500) {
        if (attempt < maxAttempts - 1) {
          const delayMs = 2_000 * 2 ** attempt;
          console.warn(`[Vibix] HTTP ${response.status}. Retrying in ${delayMs} ms.`);
          await sleep(delayMs);
          continue;
        }
        console.warn(`[Vibix] Request failed with HTTP ${response.status} after ${maxAttempts} attempts.`);
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true };
      }

      if (!response.ok) {
        console.warn(`[Vibix] Request failed with HTTP ${response.status}.`);
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true };
      }

      return { data: await response.json() as unknown, rateLimited: false, retryAfterMs: null, requestFailed: false };
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        const delayMs = 2_000 * 2 ** attempt;
        console.warn(`[Vibix] Network error. Retrying in ${delayMs} ms:`, error instanceof Error ? error.message : error);
        await sleep(delayMs);
        continue;
      }
      console.warn("[Vibix] Request failed:", error instanceof Error ? error.message : error);
      return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true };
    }
  }

  return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true };
}

async function vibixRequest(path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${VIBIX_API_URL}${path}`);
  if (searchParams) searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return fetchVibixJson(url);
}

export async function getVibixVideoLinks(params: VibixLinksParams = {}) {
  const query = new URLSearchParams({
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(Math.max(1, Math.min(params.limit ?? 100, 200))),
  });
  const response = await vibixRequest("/links", query);
  return {
    data: extractItems(response.data).map(normalizeVideo).filter((item): item is VibixVideo => item !== null),
    meta: extractMeta(response.data),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
  } satisfies VibixVideoPage;
}

export async function getVibixVideoByKpId(kpId: string | number) {
  const response = await vibixRequest(`/kp/${encodeURIComponent(String(kpId))}`);
  return extractSingle(response.data);
}

export async function getVibixVideoByImdbId(imdbId: string | number) {
  const response = await vibixRequest(`/imdb/${encodeURIComponent(String(imdbId))}`);
  return extractSingle(response.data);
}
