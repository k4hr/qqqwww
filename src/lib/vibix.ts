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

type VibixLinksParams = {
  page?: number;
  limit?: number;
};

let warnedAboutMissingKey = false;

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

async function vibixRequest(path: string, searchParams?: URLSearchParams) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${VIBIX_API_URL}${path}`);
  if (searchParams) searchParams.forEach((value, key) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn(`[Vibix] Request ${path} failed with HTTP ${response.status}.`);
      return null;
    }
    return await response.json() as unknown;
  } catch (error) {
    console.warn(`[Vibix] Request ${path} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getVibixVideoLinks(params: VibixLinksParams = {}) {
  const query = new URLSearchParams({
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(Math.max(1, Math.min(params.limit ?? 100, 100))),
  });
  const payload = await vibixRequest("/links", query);
  return extractItems(payload).map(normalizeVideo).filter((item): item is VibixVideo => item !== null);
}

export async function getVibixVideoByKpId(kpId: string | number) {
  const payload = await vibixRequest(`/kp/${encodeURIComponent(String(kpId))}`);
  return extractSingle(payload);
}

export async function getVibixVideoByImdbId(imdbId: string | number) {
  const payload = await vibixRequest(`/imdb/${encodeURIComponent(String(imdbId))}`);
  return extractSingle(payload);
}
