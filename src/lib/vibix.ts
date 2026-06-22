const VIBIX_API_ROOT = "https://vibix.org/api/v1";
const VIBIX_API_URL = `${VIBIX_API_ROOT}/publisher/videos`;

export type VibixVideo = {
  id: number | string | null;
  name: string | null;
  name_rus: string | null;
  name_eng: string | null;
  name_original: string | null;
  type: string | null;
  year: number | string | null;
  kp_id: number | string | null;
  kinopoisk_id: number | string | null;
  imdb_id: number | string | null;
  kp_rating: number | string | null;
  kp_votes: number | string | null;
  imdb_rating: number | string | null;
  imdb_votes: number | string | null;
  iframe_url: string | null;
  embed_code: string | null;
  persons: unknown;
  voiceovers: unknown;
  tags: unknown;
  poster_url: string | null;
  backdrop_url: string | null;
  quality: string | null;
  duration: number | string | null;
  genre: unknown;
  country: unknown;
  description: string | null;
  description_short: string | null;
  lgbt_content: number | string | null;
  updated_at: string | null;
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
  invalidItems: number;
  error: VibixHttpError | null;
};

export type VibixHttpError = {
  status: number;
  statusText: string;
  bodyPreview: string | null;
};

export type VibixVideoLookupResult = {
  video: VibixVideo | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
  error: VibixHttpError | null;
};

export type VibixSerial = {
  id: number | null;
  name: string | null;
  seasons: { name: string | number | null; series: { id: number | null; name: string | number | null }[] }[];
};

export type VibixSerialLookupResult = {
  serial: VibixSerial | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
  error: VibixHttpError | null;
};

export type VibixKpIdsResult = {
  kpIds: number[];
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
  error: VibixHttpError | null;
};

type VibixLinksParams = {
  page?: number;
  limit?: number;
  type?: VibixCatalogType;
  year?: number;
  categoryIds?: number[];
  genreIds?: number[];
  countryIds?: number[];
  tagIds?: number[];
  voiceoverIds?: number[];
  existKpId?: boolean | null;
  noAds?: boolean;
  lgbt?: boolean;
};

export type VibixCatalogType = "movie" | "serial";
export type VibixReferenceKind = "categories" | "genres" | "countries" | "tags" | "voiceovers";
export type VibixReferenceItem = {
  id: number;
  name: string | null;
  name_eng?: string | null;
  code?: string | null;
  raw: Record<string, unknown>;
};

export type VibixReferenceResult = {
  items: VibixReferenceItem[];
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
  error: VibixHttpError | null;
};

const VIBIX_LINK_FIELDS = [
  "id",
  "name",
  "name_rus",
  "name_eng",
  "name_original",
  "type",
  "year",
  "kp_id",
  "kinopoisk_id",
  "imdb_id",
  "kp_rating",
  "imdb_rating",
  "iframe_url",
  "voiceovers",
  "tags",
  "poster_url",
  "backdrop_url",
  "quality",
  "duration",
  "genre",
  "country",
  "description",
  "description_short",
  "updated_at",
  "uploaded_at",
] as const;

let warnedAboutMissingKey = false;

type VibixFetchResult = {
  data: unknown | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
  requestFailed: boolean;
  error: VibixHttpError | null;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeVibixLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "20"), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  // /publisher/videos/links in this account behaves like a 20-items page API.
  // Do not normalize full-sync to 50/100, otherwise resume pages no longer match
  // the already imported ~20-items-per-page progress.
  return Math.min(20, Math.max(1, parsed));
}

export function normalizeVibixKpIdsLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "100"), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  // /get_kpids rejects 10/20. Use 100 as the safe fallback batch.
  return Math.min(1000, Math.max(100, parsed));
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
  if (value === null || value === undefined || value === "") return null;
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
    name_original: firstValue(record, "name_original", "nameOriginal") as string | null,
    type: firstValue(record, "type") as string | null,
    year: firstValue(record, "year") as number | string | null,
    kp_id: firstValue(record, "kp_id", "kpId") as number | string | null,
    kinopoisk_id: firstValue(record, "kinopoisk_id", "kinopoiskId") as number | string | null,
    imdb_id: firstValue(record, "imdb_id", "imdbId") as number | string | null,
    kp_rating: firstValue(record, "kp_rating", "kpRating") as number | string | null,
    kp_votes: firstValue(record, "kp_votes", "kpVotes") as number | string | null,
    imdb_rating: firstValue(record, "imdb_rating", "imdbRating") as number | string | null,
    imdb_votes: firstValue(record, "imdb_votes", "imdbVotes") as number | string | null,
    iframe_url: firstValue(record, "iframe_url", "iframeUrl") as string | null,
    embed_code: firstValue(record, "embed_code", "embedCode") as string | null,
    persons: firstValue(record, "persons"),
    voiceovers: firstValue(record, "voiceovers"),
    tags: firstValue(record, "tags"),
    poster_url: firstValue(record, "poster_url", "posterUrl") as string | null,
    backdrop_url: firstValue(record, "backdrop_url", "backdropUrl") as string | null,
    quality: firstValue(record, "quality") as string | null,
    duration: firstValue(record, "duration") as number | string | null,
    genre: firstValue(record, "genre", "genres"),
    country: firstValue(record, "country", "countries"),
    description: firstValue(record, "description") as string | null,
    description_short: firstValue(record, "description_short", "descriptionShort") as string | null,
    lgbt_content: firstValue(record, "lgbt_content", "lgbtContent") as number | string | null,
    updated_at: firstValue(record, "updated_at", "updatedAt") as string | null,
    uploaded_at: firstValue(record, "uploaded_at", "uploadedAt") as string | null,
  };
  return video.id !== null || video.name !== null || video.name_rus !== null || video.kp_id !== null || video.imdb_id !== null || video.iframe_url !== null || video.embed_code !== null
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

async function httpError(response: Response, apiKey: string): Promise<VibixHttpError> {
  let bodyPreview: string | null = null;
  try {
    const body = (await response.text()).trim();
    if (body) bodyPreview = body.replaceAll(apiKey, "[redacted]").slice(0, 1_500);
  } catch {
    // The status information is still useful when the response body cannot be read.
  }
  return { status: response.status, statusText: response.statusText || "Request failed", bodyPreview };
}

async function fetchVibixJson(url: URL, method: "GET" | "POST" = "GET"): Promise<VibixFetchResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true, error: null };

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 404) {
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: false, error: null };
      }

      if (response.status === 429) {
        const retryAfterMs = retryAfterMilliseconds(response, attempt);
        console.warn(`[Vibix] HTTP 429. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
        return { data: null, rateLimited: true, retryAfterMs, requestFailed: false, error: await httpError(response, apiKey) };
      }

      if (response.status >= 500) {
        if (attempt < maxAttempts - 1) {
          const delayMs = 2_000 * 2 ** attempt;
          console.warn(`[Vibix] HTTP ${response.status}. Retrying in ${delayMs} ms.`);
          await sleep(delayMs);
          continue;
        }
        console.warn(`[Vibix] Request failed with HTTP ${response.status} after ${maxAttempts} attempts.`);
        const error = await httpError(response, apiKey);
        console.warn("[Vibix] Request failed:", error);
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true, error };
      }

      if (!response.ok) {
        const error = await httpError(response, apiKey);
        console.warn("[Vibix] Request failed:", error);
        return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true, error };
      }

      return { data: await response.json() as unknown, rateLimited: false, retryAfterMs: null, requestFailed: false, error: null };
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        const delayMs = 2_000 * 2 ** attempt;
        console.warn(`[Vibix] Network error. Retrying in ${delayMs} ms:`, error instanceof Error ? error.message : error);
        await sleep(delayMs);
        continue;
      }
      console.warn("[Vibix] Request failed:", error instanceof Error ? error.message : error);
      return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true, error: null };
    }
  }

  return { data: null, rateLimited: false, retryAfterMs: null, requestFailed: true, error: null };
}

function appendSearchParams(url: URL, searchParams?: URLSearchParams) {
  if (!searchParams) return;
  searchParams.forEach((value, key) => url.searchParams.append(key, value));
}

async function vibixRequest(path: string, searchParams?: URLSearchParams, method: "GET" | "POST" = "GET") {
  const url = new URL(`${VIBIX_API_URL}${path}`);
  appendSearchParams(url, searchParams);
  return fetchVibixJson(url, method);
}

async function vibixRootRequest(path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${VIBIX_API_ROOT}${path}`);
  appendSearchParams(url, searchParams);
  return fetchVibixJson(url);
}

function extractSerial(payload: unknown): VibixSerial | null {
  const record = asRecord(payload);
  if (!record) return null;
  const seasonsValue = firstValue(record, "seasons");
  if (record.id !== undefined || record.name !== undefined || Array.isArray(seasonsValue)) {
    const seasons = Array.isArray(seasonsValue) ? seasonsValue.flatMap((seasonValue) => {
      const season = asRecord(seasonValue);
      if (!season) return [];
      const seriesValue = firstValue(season, "series");
      const series = Array.isArray(seriesValue) ? seriesValue.flatMap((episodeValue) => {
        const episode = asRecord(episodeValue);
        if (!episode) return [];
        return [{ id: numberValue(episode.id), name: typeof episode.name === "string" || typeof episode.name === "number" ? episode.name : null }];
      }) : [];
      return [{ name: typeof season.name === "string" || typeof season.name === "number" ? season.name : null, series }];
    }) : [];
    return { id: numberValue(record.id), name: typeof record.name === "string" ? record.name : null, seasons };
  }
  for (const key of ["data", "item", "result", "serial"]) {
    const serial = extractSerial(record[key]);
    if (serial) return serial;
  }
  return null;
}

async function getVibixSerialResult(path: string): Promise<VibixSerialLookupResult> {
  const response = await vibixRootRequest(path);
  return {
    serial: extractSerial(response.data),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}

export function getVibixSerialByKpIdResult(kpId: string | number) {
  return getVibixSerialResult(`/serials/kp/${encodeURIComponent(String(kpId))}`);
}

export function getVibixSerialByImdbIdResult(imdbId: string | number) {
  return getVibixSerialResult(`/serials/imdb/${encodeURIComponent(String(imdbId))}`);
}

export async function getVibixKpIds(params: { type: VibixCatalogType; year?: number; page?: number; limit?: number; categoryIds?: number[] }): Promise<VibixKpIdsResult> {
  const query = new URLSearchParams({
    type: params.type,
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(normalizeVibixKpIdsLimit(params.limit)),
  });
  if (params.year) query.set("year", String(params.year));
  for (const categoryId of params.categoryIds ?? []) query.append("category[]", String(categoryId));
  const response = await vibixRequest("/get_kpids", query);
  const kpIds = extractItems(response.data)
    .map(numberValue)
    .filter((value): value is number => value !== null && Number.isSafeInteger(value) && value > 0);
  return {
    kpIds: Array.from(new Set(kpIds)),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}


function appendNumericArray(query: URLSearchParams, key: string, values?: number[]) {
  for (const value of values ?? []) {
    if (Number.isSafeInteger(value) && value > 0) query.append(key, String(value));
  }
}

export async function getVibixVideoLinks(params: VibixLinksParams = {}) {
  const query = new URLSearchParams({
    type: params.type ?? "movie",
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(normalizeVibixLimit(params.limit)),
  });

  // Vibix current /publisher/videos/links documentation lists only the filter params
  // category[], year[], genre[], country[], tag[], voiceover[], page and limit.
  // Do not send fields[] or undocumented flags here: they can make Vibix return 500.
  if (params.year) query.append("year[]", String(params.year));
  appendNumericArray(query, "category[]", params.categoryIds);
  appendNumericArray(query, "genre[]", params.genreIds);
  appendNumericArray(query, "country[]", params.countryIds);
  appendNumericArray(query, "tag[]", params.tagIds);
  appendNumericArray(query, "voiceover[]", params.voiceoverIds);

  const response = await vibixRequest("/links", query);
  const rawItems = extractItems(response.data);
  const data = rawItems.map(normalizeVideo).filter((item): item is VibixVideo => item !== null);
  return {
    data,
    meta: extractMeta(response.data),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    invalidItems: rawItems.length - data.length,
    error: response.error,
  } satisfies VibixVideoPage;
}

export async function getVibixVideoByKpIdResult(kpId: string | number): Promise<VibixVideoLookupResult> {
  const response = await vibixRequest(`/kp/${encodeURIComponent(String(kpId))}`);
  return {
    video: extractSingle(response.data),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}

export async function getVibixVideoByImdbIdResult(imdbId: string | number): Promise<VibixVideoLookupResult> {
  const response = await vibixRequest(`/imdb/${encodeURIComponent(String(imdbId))}`);
  return {
    video: extractSingle(response.data),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}


function normalizeReferenceItem(value: unknown): VibixReferenceItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = numberValue(record.id);
  if (id === null) return null;
  const name = typeof record.name === "string" ? record.name : null;
  const nameEng = typeof record.name_eng === "string" ? record.name_eng : typeof record.nameEng === "string" ? record.nameEng : null;
  const code = typeof record.code === "string" ? record.code : null;
  return { id, name, name_eng: nameEng, code, raw: record };
}

export async function getVibixReferenceItems(kind: VibixReferenceKind): Promise<VibixReferenceResult> {
  const response = await vibixRequest(`/${kind}`);
  return {
    items: extractItems(response.data).map(normalizeReferenceItem).filter((item): item is VibixReferenceItem => item !== null),
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}

export async function searchVibixVideoResult(
  name: string,
  options: { year?: number; type?: VibixCatalogType } = {},
): Promise<VibixVideoLookupResult> {
  const query = new URLSearchParams({ name, page: "1", limit: "20" });
  const response = await vibixRequest("/search", query, "POST");
  const videos = extractItems(response.data).map(normalizeVideo).filter((item): item is VibixVideo => item !== null);
  const normalizedName = name.trim().toLocaleLowerCase("ru-RU");
  const video = videos.find((item) => {
    const sameType = !options.type || item.type === options.type;
    const sameYear = !options.year || numberValue(item.year) === options.year;
    const names = [item.name_rus, item.name, item.name_eng, item.name_original].filter((value): value is string => typeof value === "string");
    return sameType && sameYear && names.some((value) => value.trim().toLocaleLowerCase("ru-RU") === normalizedName);
  }) ?? videos.find((item) => (!options.type || item.type === options.type) && (!options.year || numberValue(item.year) === options.year)) ?? null;
  return {
    video,
    rateLimited: response.rateLimited,
    retryAfterMs: response.retryAfterMs,
    requestFailed: response.requestFailed,
    error: response.error,
  };
}

export async function getVibixVideoByKpId(kpId: string | number) {
  return (await getVibixVideoByKpIdResult(kpId)).video;
}

export async function getVibixVideoByImdbId(imdbId: string | number) {
  return (await getVibixVideoByImdbIdResult(imdbId)).video;
}
