import { ContentType, type Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { evaluateMovieCatalogVisibility } from "@/lib/catalog-filters";
import { calculateHomeQuality } from "@/lib/home-quality-score";
import {
  getVibixVideoByImdbId,
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpId,
  getVibixVideoByKpIdResult,
  getVibixVideoLinks,
  normalizeVibixLimit,
  sleep,
  type VibixCatalogType,
  type VibixVideo,
} from "@/lib/vibix";

export type VibixSkippedReason =
  | "missing_player_source"
  | "missing_title"
  | "missing_identifier"
  | "unknown_type"
  | "invalid_response"
  | "other";

export type VibixSkippedSample = {
  id: number | string | null;
  name: string | null;
  name_rus: string | null;
  kp_id: number | string | null;
  kinopoisk_id: number | string | null;
  imdb_id: number | string | null;
  iframe_url: string | null;
  embed_code: string | null;
  reason: VibixSkippedReason;
};

export type VibixSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  pagesProcessed: number;
  totalFromVibix: number;
  startedAt: string;
  finishedAt: string;
  rateLimited: boolean;
  message: string | null;
  httpStatus: number | null;
  httpStatusText: string | null;
  httpBodyPreview: string | null;
  enrichedByKp: number;
  enrichedByImdb: number;
  enrichmentFailed: number;
  playerSourceByIframeUrl: number;
  playerSourceByEmbedCode: number;
  skippedReasons: Record<VibixSkippedReason, number>;
  skippedSamples: VibixSkippedSample[];
};

type SyncOptions = {
  mode?: "quick" | "all";
  pages?: number;
  limit?: number;
  pageDelayMs?: number;
  detailDelayMs?: number;
  maxPagesPerRun?: number;
  types?: VibixCatalogType[];
  existKpId?: boolean | null;
  noAds?: boolean;
  lgbt?: boolean;
};

export type VibixPageSyncOptions = {
  page: number;
  limit?: number;
  type: VibixCatalogType;
  detailDelayMs?: number;
};

export type VibixPageSyncResult = VibixSyncResult & {
  page: number;
  type: VibixCatalogType;
  lastPage: number | null;
  total: number | null;
  itemsReceived: number;
  retryAfterMs: number | null;
};

type NormalizedVideo = {
  title: string;
  titleOriginal: string | null;
  description: string | null;
  year: number;
  kinopoiskId: string | null;
  imdbId: string | null;
  iframeUrl: string | null;
  embedCode: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  quality: string;
  duration: number | null;
  country: string | null;
  kpRating: number | null;
  kpVotes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  tags: string[];
  voiceovers: string[];
  lgbtContent: number | null;
  actorPowerScore: number;
  type: ContentType;
  vibixType: string;
  vibixId: number | null;
  vibixUploadedAt: Date | null;
  vibixUpdatedAt: Date | null;
};

const vibixSyncState = globalThis as typeof globalThis & { __redfilmVibixSyncRunning?: boolean };

export class VibixSyncAlreadyRunningError extends Error {
  constructor() {
    super("Vibix sync is already running");
    this.name = "VibixSyncAlreadyRunningError";
  }
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= -2_147_483_648 && parsed <= 2_147_483_647 ? parsed : null;
}

function floatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  const normalized = stringValue(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return stringValue(value);
  if (Array.isArray(value)) {
    const parts = value.map(textFromUnknown).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringValue(record.name ?? record.title ?? record.value);
  }
  return null;
}

function contentType(value: unknown) {
  const normalized = stringValue(value)?.toLowerCase() ?? "";
  if (["movie", "film"].includes(normalized)) return ContentType.MOVIE;
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return ContentType.SERIES;
  return null;
}

function normalizeVideoData(video: VibixVideo): { data: NormalizedVideo } | { reason: VibixSkippedReason } {
  const iframeUrl = stringValue(video.iframe_url);
  const embedCode = stringValue(video.embed_code);
  if (!iframeUrl && !embedCode) return { reason: "missing_player_source" };

  const title = stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_eng) || stringValue(video.name_original);
  if (!title) return { reason: "missing_title" };

  const kinopoiskId = stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
  const imdbId = stringValue(video.imdb_id);
  const vibixId = intValue(video.id);
  if (!kinopoiskId && !imdbId && vibixId === null) return { reason: "missing_identifier" };

  const type = contentType(video.type);
  if (!type) return { reason: "unknown_type" };

  const year = intValue(video.year);
  if (!year || year < 1880 || year > 2200) return { reason: "other" };

  return {
    data: {
      title,
      titleOriginal: stringValue(video.name_original) || stringValue(video.name_eng),
      description: stringValue(video.description) || stringValue(video.description_short),
      year,
      kinopoiskId,
      imdbId,
      iframeUrl,
      embedCode,
      posterUrl: stringValue(video.poster_url),
      backdropUrl: stringValue(video.backdrop_url),
      quality: stringValue(video.quality) || "HD",
      duration: intValue(video.duration),
      country: textFromUnknown(video.country),
      kpRating: floatValue(video.kp_rating),
      kpVotes: intValue(video.kp_votes),
      imdbRating: floatValue(video.imdb_rating),
      imdbVotes: intValue(video.imdb_votes),
      tags: namesFromUnknown(video.tags),
      voiceovers: namesFromUnknown(video.voiceovers),
      lgbtContent: intValue(video.lgbt_content),
      actorPowerScore: Math.min(10, namesFromUnknown(video.persons).length),
      type,
      vibixType: stringValue(video.type) || "movie",
      vibixId,
      vibixUploadedAt: dateValue(video.uploaded_at),
      vibixUpdatedAt: dateValue(video.updated_at),
    },
  };
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "");
}

export function mergeVibixRecords(base: VibixVideo, details: VibixVideo | null): VibixVideo {
  if (!details) return { ...base };
  const merged = { ...base };
  for (const key of Object.keys(base) as (keyof VibixVideo)[]) {
    if (hasValue(details[key])) merged[key] = details[key] as never;
  }
  return merged;
}

function skippedSample(base: VibixVideo, enriched: VibixVideo, reason: VibixSkippedReason): VibixSkippedSample {
  return {
    id: enriched.id ?? base.id,
    name: enriched.name ?? base.name,
    name_rus: enriched.name_rus ?? base.name_rus,
    kp_id: enriched.kp_id ?? base.kp_id,
    kinopoisk_id: enriched.kinopoisk_id ?? base.kinopoisk_id,
    imdb_id: enriched.imdb_id ?? base.imdb_id,
    iframe_url: stringValue(enriched.iframe_url) || stringValue(base.iframe_url),
    embed_code: stringValue(enriched.embed_code) || stringValue(base.embed_code),
    reason,
  };
}

function diagnosticSample(video: VibixVideo) {
  return {
    id: video.id,
    name: video.name,
    name_rus: video.name_rus,
    kp_id: video.kp_id,
    kinopoisk_id: video.kinopoisk_id,
    imdb_id: video.imdb_id,
    iframe_url: video.iframe_url,
    embed_code: video.embed_code,
    type: video.type,
  };
}

function registerSkip(result: VibixSyncResult, reason: VibixSkippedReason, video?: VibixVideo, count = 1, baseVideo = video) {
  result.skipped += count;
  result.skippedReasons[reason] += count;
  if (video && baseVideo && result.skippedSamples.length < 3) result.skippedSamples.push(skippedSample(baseVideo, video, reason));
}

type EnrichmentResult = {
  video: VibixVideo;
  rateLimited: boolean;
  retryAfterMs: number | null;
};

async function enrichVibixVideo(
  base: VibixVideo,
  result: VibixSyncResult,
  waitForDetailRequest: () => Promise<void>,
): Promise<EnrichmentResult> {
  const hasPlayer = Boolean(stringValue(base.iframe_url) || stringValue(base.embed_code));
  const hasDetailData = Boolean(
    (base.kp_votes !== null && base.kp_votes !== undefined)
    || (base.imdb_votes !== null && base.imdb_votes !== undefined)
    || base.persons
    || stringValue(base.embed_code),
  );
  if (hasPlayer && hasDetailData) return { video: base, rateLimited: false, retryAfterMs: null };

  let enriched = { ...base };
  const kpId = stringValue(base.kp_id) || stringValue(base.kinopoisk_id);
  if (kpId) {
    await waitForDetailRequest();
    const lookup = await getVibixVideoByKpIdResult(kpId);
    if (lookup.rateLimited) return { video: enriched, rateLimited: true, retryAfterMs: lookup.retryAfterMs };
    if (lookup.video) {
      enriched = mergeVibixRecords(enriched, lookup.video);
      if (stringValue(enriched.iframe_url) || stringValue(enriched.embed_code)) {
        result.enrichedByKp += 1;
        return { video: enriched, rateLimited: false, retryAfterMs: null };
      }
    }
  }

  const imdbId = stringValue(enriched.imdb_id) || stringValue(base.imdb_id);
  if (imdbId) {
    await waitForDetailRequest();
    const lookup = await getVibixVideoByImdbIdResult(imdbId);
    if (lookup.rateLimited) return { video: enriched, rateLimited: true, retryAfterMs: lookup.retryAfterMs };
    if (lookup.video) {
      enriched = mergeVibixRecords(enriched, lookup.video);
      if (stringValue(enriched.iframe_url) || stringValue(enriched.embed_code)) {
        result.enrichedByImdb += 1;
        return { video: enriched, rateLimited: false, retryAfterMs: null };
      }
    }
  }

  result.enrichmentFailed += 1;
  return { video: enriched, rateLimited: false, retryAfterMs: null };
}

async function uniqueSlug(title: string, year: number) {
  const base = slugify(`${title}-${year}`) || `movie-${year}`;
  let slug = base;
  let index = 2;
  while (await prisma.movie.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

async function findExisting(kinopoiskId: string | null, imdbId: string | null, vibixId: number | null) {
  if (kinopoiskId) {
    const movie = await prisma.movie.findFirst({ where: { kinopoiskId } });
    if (movie) return movie;
  }
  if (imdbId) {
    const movie = await prisma.movie.findFirst({ where: { imdbId } });
    if (movie) return movie;
  }
  if (vibixId !== null) return prisma.movie.findFirst({ where: { vibixId } });
  return null;
}

function namesFromUnknown(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  if (Array.isArray(value)) return Array.from(new Set(value.flatMap(namesFromUnknown)));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const ownName = stringValue(record.name_rus) || stringValue(record.name) || stringValue(record.title);
    return ownName ? [ownName] : Object.values(record).flatMap(namesFromUnknown);
  }
  return [];
}

async function syncVibixRelations(movieId: string, video: VibixVideo) {
  const genres = namesFromUnknown(video.genre).slice(0, 20);
  if (genres.length) {
    await prisma.movieGenre.deleteMany({ where: { movieId } });
    for (const name of genres) {
      const genreSlug = slugify(name);
      const genre = await prisma.genre.findFirst({ where: { OR: [{ name }, { slug: genreSlug }] } })
        ?? await prisma.genre.create({ data: { name, slug: genreSlug } });
      await prisma.movieGenre.create({ data: { movieId, genreId: genre.id } });
    }
  }
  const people = namesFromUnknown(video.persons).slice(0, 20);
  if (people.length) {
    await prisma.movieCast.deleteMany({ where: { movieId } });
    for (const [sortOrder, name] of people.entries()) {
      const person = await prisma.person.findFirst({ where: { nameRu: name } }) ?? await prisma.person.create({ data: { nameRu: name } });
      await prisma.movieCast.create({ data: { movieId, personId: person.id, sortOrder } });
    }
  }
}

async function applyQualityGate(movieId: string) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, include: { genres: { include: { genre: true } } } });
  if (!movie) return;
  const score = calculateHomeQuality(movie);
  await prisma.movie.update({ where: { id: movie.id }, data: { ...score, lastQualitySyncAt: new Date() } });
}

export async function saveVibixVideo(video: VibixVideo, targetMovieId?: string) {
  const normalized = normalizeVideoData(video);
  if ("reason" in normalized) return { status: "skipped" as const, reason: normalized.reason };
  const data = normalized.data;
  const existing = targetMovieId
    ? await prisma.movie.findUnique({ where: { id: targetMovieId } })
    : await findExisting(data.kinopoiskId, data.imdbId, data.vibixId);
  const syncedAt = new Date();

  if (existing) {
    const catalogVisibility = evaluateMovieCatalogVisibility({ country: data.country || existing.country });
    const updated = await prisma.movie.update({
      where: { id: existing.id },
      data: {
        titleRu: data.title,
        titleOriginal: data.titleOriginal || undefined,
        description: data.description || undefined,
        year: data.year,
        type: data.type,
        posterUrl: data.posterUrl || undefined,
        backdropUrl: data.backdropUrl || undefined,
        quality: data.quality,
        duration: data.duration || undefined,
        country: data.country || undefined,
        ...catalogVisibility,
        kinopoiskId: data.kinopoiskId || undefined,
        imdbId: data.imdbId || undefined,
        kpRating: data.kpRating ?? undefined,
        kpVotes: data.kpVotes ?? undefined,
        imdbRating: data.imdbRating ?? undefined,
        imdbVotes: data.imdbVotes ?? undefined,
        vibixId: data.vibixId,
        vibixIframeUrl: data.iframeUrl,
        vibixEmbedCode: data.embedCode,
        vibixAvailable: true,
        vibixType: data.vibixType,
        vibixUploadedAt: data.vibixUploadedAt,
        vibixUpdatedAt: data.vibixUpdatedAt,
        vibixLastSyncAt: syncedAt,
        vibixTags: data.tags,
        vibixVoiceovers: data.voiceovers,
        vibixLgbtContent: data.lgbtContent,
        actorPowerScore: data.actorPowerScore,
        isPublished: true,
      },
    });
    await syncVibixRelations(updated.id, video);
    await applyQualityGate(updated.id);
    return { status: "updated" as const, movieId: existing.id };
  }

  const catalogVisibility = evaluateMovieCatalogVisibility({ country: data.country });
  const created = await prisma.movie.create({
    data: {
      slug: await uniqueSlug(data.title, data.year),
      titleRu: data.title,
      titleOriginal: data.titleOriginal,
      description: data.description || `${data.title} (${data.year}) доступен для просмотра на REDFILM.`,
      year: data.year,
      type: data.type,
      posterUrl: data.posterUrl,
      backdropUrl: data.backdropUrl,
      quality: data.quality,
      duration: data.duration,
      country: data.country,
      ...catalogVisibility,
      kinopoiskId: data.kinopoiskId,
      imdbId: data.imdbId,
      kpRating: data.kpRating,
      kpVotes: data.kpVotes,
      imdbRating: data.imdbRating,
      imdbVotes: data.imdbVotes,
      vibixId: data.vibixId,
      vibixIframeUrl: data.iframeUrl,
      vibixEmbedCode: data.embedCode,
      vibixAvailable: true,
      vibixType: data.vibixType,
      vibixUploadedAt: data.vibixUploadedAt,
      vibixUpdatedAt: data.vibixUpdatedAt,
      vibixLastSyncAt: syncedAt,
      vibixTags: data.tags,
      vibixVoiceovers: data.voiceovers,
      vibixLgbtContent: data.lgbtContent,
      actorPowerScore: data.actorPowerScore,
      isPublished: true,
    },
  });
  await syncVibixRelations(created.id, video);
  await applyQualityGate(created.id);
  return { status: "imported" as const, movieId: created.id };
}

function emptySyncResult(): VibixSyncResult {
  const startedAt = new Date().toISOString();
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    pagesProcessed: 0,
    totalFromVibix: 0,
    startedAt,
    finishedAt: startedAt,
    rateLimited: false,
    message: null,
    httpStatus: null,
    httpStatusText: null,
    httpBodyPreview: null,
    enrichedByKp: 0,
    enrichedByImdb: 0,
    enrichmentFailed: 0,
    playerSourceByIframeUrl: 0,
    playerSourceByEmbedCode: 0,
    skippedReasons: {
      missing_player_source: 0,
      missing_title: 0,
      missing_identifier: 0,
      unknown_type: 0,
      invalid_response: 0,
      other: 0,
    },
    skippedSamples: [],
  };
}

export async function syncVibixPage(options: VibixPageSyncOptions): Promise<VibixPageSyncResult> {
  const page = Math.max(1, Math.min(Math.trunc(options.page), 10_000));
  const limit = normalizeVibixLimit(options.limit);
  const detailDelayMs = Math.max(2_000, Math.min(options.detailDelayMs ?? 2_000, 10_000));
  const result = emptySyncResult();
  const response = await getVibixVideoLinks({ page, limit, type: options.type, existKpId: null });
  let retryAfterMs = response.retryAfterMs;

  if (response.rateLimited) {
    result.rateLimited = true;
    result.message = "Vibix API rate limit reached";
    result.httpStatus = response.error?.status ?? 429;
    result.httpStatusText = response.error?.statusText ?? "Too Many Requests";
    result.httpBodyPreview = response.error?.bodyPreview ?? null;
  } else if (response.requestFailed) {
    result.errors = 1;
    result.httpStatus = response.error?.status ?? null;
    result.httpStatusText = response.error?.statusText ?? null;
    result.httpBodyPreview = response.error?.bodyPreview ?? null;
    result.message = response.error
      ? `HTTP ${response.error.status} ${response.error.statusText}`
      : "Vibix API request failed";
  } else {
    result.pagesProcessed = 1;
    result.totalFromVibix = response.meta?.total ?? response.data.length + response.invalidItems;
    if (response.invalidItems) registerSkip(result, "invalid_response", undefined, response.invalidItems);

    let lastDetailRequestAt = 0;
    const waitForDetailRequest = async () => {
      const remainingDelay = detailDelayMs - (Date.now() - lastDetailRequestAt);
      if (remainingDelay > 0) await sleep(remainingDelay);
      lastDetailRequestAt = Date.now();
    };

    for (const video of response.data) {
      try {
        const enrichment = await enrichVibixVideo(video, result, waitForDetailRequest);
        if (enrichment.rateLimited) {
          result.rateLimited = true;
          result.message = "Vibix API rate limit reached during enrichment";
          retryAfterMs = enrichment.retryAfterMs;
          break;
        }
        const saved = await saveVibixVideo(enrichment.video);
        if (saved.status === "skipped") registerSkip(result, saved.reason, enrichment.video, 1, video);
        else {
          result[saved.status] += 1;
          if (stringValue(enrichment.video.iframe_url)) result.playerSourceByIframeUrl += 1;
          else result.playerSourceByEmbedCode += 1;
        }
      } catch (error) {
        result.errors += 1;
        console.warn("[Vibix] Failed to save video:", error instanceof Error ? error.message : error);
      }
    }
  }

  result.finishedAt = new Date().toISOString();
  return {
    ...result,
    page,
    type: options.type,
    lastPage: response.meta?.lastPage ?? null,
    total: response.meta?.total ?? null,
    itemsReceived: response.data.length + response.invalidItems,
    retryAfterMs,
  };
}

export async function syncVibixVideos(options: SyncOptions = {}): Promise<VibixSyncResult> {
  if (vibixSyncState.__redfilmVibixSyncRunning) throw new VibixSyncAlreadyRunningError();
  vibixSyncState.__redfilmVibixSyncRunning = true;

  const startedAt = new Date().toISOString();
  const mode = options.mode ?? "quick";
  const quickPages = Math.max(1, Math.min(options.pages ?? 5, 1000));
  const limit = normalizeVibixLimit(options.limit);
  const pageDelayMs = Math.max(10_000, Math.min(options.pageDelayMs ?? 10_000, 60_000));
  const detailDelayMs = Math.max(2_000, Math.min(options.detailDelayMs ?? 2_000, 10_000));
  const maxPagesPerRun = Math.max(1, Math.min(options.maxPagesPerRun ?? (mode === "quick" ? quickPages : 20), 10_000));
  const defaultTypes: VibixCatalogType[] = ["movie", "serial"];
  const types: VibixCatalogType[] = Array.from(new Set(options.types?.length ? options.types : defaultTypes));
  const pagesPerType = mode === "quick" ? quickPages : Math.max(1, Math.floor(maxPagesPerRun / types.length));
  const result = emptySyncResult();
  result.startedAt = startedAt;
  result.finishedAt = startedAt;

  try {
    let stopSync = false;
    let lastDetailRequestAt = 0;
    const waitForDetailRequest = async () => {
      const remainingDelay = detailDelayMs - (Date.now() - lastDetailRequestAt);
      if (remainingDelay > 0) await sleep(remainingDelay);
      lastDetailRequestAt = Date.now();
    };
    for (const catalogType of types) {
      if (stopSync || result.pagesProcessed >= maxPagesPerRun) break;
      let page = 1;
      let lastPage: number | null = null;
      let hasReportedTotal = false;

      while (page <= pagesPerType && result.pagesProcessed < maxPagesPerRun) {
        if (lastPage !== null && page > lastPage) break;

        const response = await getVibixVideoLinks({
          page,
          limit,
          type: catalogType,
          existKpId: options.existKpId ?? (mode === "quick" ? true : null),
          noAds: options.noAds,
          lgbt: options.lgbt,
        });
        if (response.rateLimited) {
          result.rateLimited = true;
          result.message = "Vibix API rate limit reached";
          stopSync = true;
          break;
        }
        if (response.requestFailed) {
          result.errors += 1;
          result.httpStatus = response.error?.status ?? null;
          result.httpStatusText = response.error?.statusText ?? null;
          result.httpBodyPreview = response.error?.bodyPreview ?? null;
          result.message = response.error
            ? `HTTP ${response.error.status} ${response.error.statusText}`
            : "Vibix API request failed";
          stopSync = true;
          break;
        }
        if (response.meta?.lastPage !== null && response.meta?.lastPage !== undefined) {
          lastPage = Math.min(Math.max(1, response.meta.lastPage), 10_000);
        }
        if (response.meta?.total !== null && response.meta?.total !== undefined) {
          if (!hasReportedTotal) result.totalFromVibix += Math.max(0, response.meta.total);
          hasReportedTotal = true;
        }
        if (!response.data.length && !response.invalidItems) break;

        if (page === 1) {
          console.info(`[Vibix] First ${catalogType} page samples:`, response.data.slice(0, 2).map(diagnosticSample));
        }

        result.pagesProcessed += 1;
        if (!hasReportedTotal) result.totalFromVibix += response.data.length + response.invalidItems;
        if (response.invalidItems) registerSkip(result, "invalid_response", undefined, response.invalidItems);

        for (const video of response.data) {
          try {
            const enrichment = await enrichVibixVideo(video, result, waitForDetailRequest);
            if (enrichment.rateLimited) {
              result.rateLimited = true;
              result.message = "Vibix API rate limit reached during enrichment";
              stopSync = true;
              break;
            }
            const saved = await saveVibixVideo(enrichment.video);
            if (saved.status === "skipped") {
              registerSkip(result, saved.reason, enrichment.video, 1, video);
            }
            else {
              result[saved.status] += 1;
              if (stringValue(enrichment.video.iframe_url)) result.playerSourceByIframeUrl += 1;
              else result.playerSourceByEmbedCode += 1;
            }
          } catch (error) {
            result.errors += 1;
            console.warn("[Vibix] Failed to save video:", error instanceof Error ? error.message : error);
          }
        }

        if (stopSync) break;

        const hasMorePages = page < pagesPerType && (lastPage === null || page < lastPage);
        page += 1;
        if (hasMorePages) await sleep(pageDelayMs);
      }
    }

    result.finishedAt = new Date().toISOString();
    return result;
  } finally {
    vibixSyncState.__redfilmVibixSyncRunning = false;
  }
}

export async function ensureVibixPlayback(movie: Movie) {
  if (movie.vibixIframeUrl || movie.vibixEmbedCode) return movie;
  let video = movie.kinopoiskId ? await getVibixVideoByKpId(movie.kinopoiskId) : null;
  if (!video && movie.imdbId) video = await getVibixVideoByImdbId(movie.imdbId);
  if (!video) return movie;
  const saved = await saveVibixVideo(video, movie.id);
  if (saved.status === "skipped") return movie;
  return (await prisma.movie.findUnique({ where: { id: movie.id } })) ?? movie;
}
