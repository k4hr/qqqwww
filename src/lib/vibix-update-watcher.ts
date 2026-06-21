import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateMovieHomeScore } from "@/lib/trend-engine";
import { saveVibixVideo } from "@/lib/vibix-sync";
import {
  getVibixSerialByImdbIdResult,
  getVibixSerialByKpIdResult,
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpIdResult,
  getVibixVideoLinks,
  sleep,
  type VibixCatalogType,
  type VibixVideo,
} from "@/lib/vibix";

export type VibixUpdateWatcherOptions = {
  pagesPerRun?: number;
  limit?: number;
  detailLimit?: number;
  detailDelayMs?: number;
  types?: VibixCatalogType[];
};

function dateValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function contentType(value: VibixCatalogType) {
  return value === "serial" ? ContentType.SERIES : ContentType.MOVIE;
}

function isNewer(a: Date | null, b: Date | null | undefined) {
  if (!a) return false;
  if (!b) return true;
  return a.getTime() > b.getTime();
}

async function serialCounts(type: VibixCatalogType, video: VibixVideo) {
  if (type !== "serial") return null;
  const imdbId = stringValue(video.imdb_id);
  const kpId = stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
  const result = imdbId ? await getVibixSerialByImdbIdResult(imdbId) : kpId ? await getVibixSerialByKpIdResult(kpId) : null;
  if (!result?.serial) return null;
  return {
    vibixSeasonCount: result.serial.seasons.length,
    vibixEpisodeCount: result.serial.seasons.reduce((total, season) => total + season.series.length, 0),
  };
}

async function getDetail(video: VibixVideo) {
  const kpId = stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
  const imdbId = stringValue(video.imdb_id);
  if (kpId) {
    const lookup = await getVibixVideoByKpIdResult(kpId);
    if (lookup.video || lookup.rateLimited || lookup.requestFailed) return lookup;
  }
  if (imdbId) return getVibixVideoByImdbIdResult(imdbId);
  return { video: null, rateLimited: false, retryAfterMs: null, requestFailed: false, error: null };
}

export async function runVibixUpdateWatcher(options: VibixUpdateWatcherOptions = {}) {
  const pagesPerRun = Math.max(1, Math.min(options.pagesPerRun ?? Number(process.env.VIBIX_UPDATE_PAGES_PER_RUN || 5), 50));
  const limit = Math.max(1, Math.min(options.limit ?? Number(process.env.VIBIX_UPDATE_LIMIT || 50), 100));
  const detailLimit = Math.max(0, Math.min(options.detailLimit ?? Number(process.env.VIBIX_UPDATE_DETAIL_LIMIT || 100), 500));
  const detailDelayMs = Math.max(0, options.detailDelayMs ?? Number(process.env.VIBIX_UPDATE_DETAIL_DELAY_MS || 750));
  const envTypes = (process.env.VIBIX_UPDATE_TYPES || "movie,serial").split(",").map((item) => item.trim()).filter(Boolean) as VibixCatalogType[];
  const types = Array.from(new Set(options.types?.length ? options.types : envTypes)).filter((item): item is VibixCatalogType => item === "movie" || item === "serial");

  const run = await prisma.catalogEngineRun.create({ data: { status: "RUNNING", mode: "vibix_update" } });
  const result = {
    found: 0,
    imported: 0,
    updated: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    rateLimited: false,
    retryAfterMs: null as number | null,
    types,
    pagesPerRun,
    detailLimit,
    samples: [] as { title: string; type: string; status: string; kpId?: string | null; imdbId?: string | null }[],
  };

  try {
    let detailCalls = 0;
    for (const type of types) {
      const cursor = await prisma.vibixUpdateCursor.upsert({
        where: { id: `vibix-${type}-updates` },
        create: { id: `vibix-${type}-updates`, type: contentType(type), lastRunAt: new Date(), isRunning: true },
        update: { lastRunAt: new Date(), isRunning: true, lastError: null },
      });

      for (let page = 1; page <= pagesPerRun; page += 1) {
        const links = await getVibixVideoLinks({ type, page, limit, existKpId: true, noAds: true, lgbt: false });
        if (links.rateLimited) {
          result.rateLimited = true;
          result.retryAfterMs = links.retryAfterMs;
          await prisma.vibixUpdateCursor.update({ where: { id: cursor.id }, data: { isRunning: false, lastError: "HTTP 429 Too Many Requests" } });
          break;
        }
        if (links.requestFailed) {
          result.failed += 1;
          await prisma.vibixUpdateCursor.update({ where: { id: cursor.id }, data: { isRunning: false, lastError: links.error ? `HTTP ${links.error.status}` : "Vibix links request failed" } });
          continue;
        }
        if (!links.data.length) break;
        result.found += links.data.length;

        for (const baseVideo of links.data) {
          const kpId = stringValue(baseVideo.kp_id) || stringValue(baseVideo.kinopoisk_id);
          const imdbId = stringValue(baseVideo.imdb_id);
          const vibixId = Number(baseVideo.id ?? 0) || null;
          const uploadedAt = dateValue(baseVideo.uploaded_at);
          const updatedAt = dateValue(baseVideo.updated_at);
          const identifiers = [
            ...(kpId ? [{ kinopoiskId: kpId }] : []),
            ...(imdbId ? [{ imdbId }] : []),
            ...(vibixId ? [{ vibixId }] : []),
          ];
          if (!identifiers.length) {
            result.skipped += 1;
            continue;
          }
          const existing = await prisma.movie.findFirst({ where: { OR: identifiers } });
          const needsUpdate = !existing || isNewer(updatedAt, existing.vibixUpdatedAt) || isNewer(uploadedAt, existing.vibixUploadedAt) || !existing.vibixEmbedCode || existing.kpVotes === null || existing.imdbVotes === null;
          if (!needsUpdate) {
            result.skipped += 1;
            continue;
          }

          let video = baseVideo;
          if (detailCalls < detailLimit) {
            if (detailCalls > 0 && detailDelayMs) await sleep(detailDelayMs);
            const detail = await getDetail(baseVideo);
            detailCalls += 1;
            if (detail.rateLimited) {
              result.rateLimited = true;
              result.retryAfterMs = detail.retryAfterMs;
              break;
            }
            if (detail.video) {
              video = { ...baseVideo, ...detail.video };
              result.enriched += 1;
            }
          }

          const saved = await saveVibixVideo(video, existing?.id);
          if (saved.status === "skipped") {
            result.skipped += 1;
            if (result.samples.length < 10) result.samples.push({ title: stringValue(video.name_rus) || stringValue(video.name) || "Без названия", type, status: `SKIPPED:${saved.reason}`, kpId, imdbId });
            continue;
          }
          const counts = await serialCounts(type, video);
          if (counts) await prisma.movie.update({ where: { id: saved.movieId }, data: counts });
          await recalculateMovieHomeScore(saved.movieId);
          if (saved.status === "imported") result.imported += 1;
          else result.updated += 1;
          if (result.samples.length < 10) result.samples.push({ title: stringValue(video.name_rus) || stringValue(video.name) || "Без названия", type, status: saved.status, kpId, imdbId });
        }
        if (result.rateLimited) break;
      }

      await prisma.vibixUpdateCursor.update({
        where: { id: `vibix-${type}-updates` },
        data: { isRunning: false, lastSuccessAt: result.rateLimited ? undefined : new Date(), lastSeenUpdatedAt: new Date(), lastPage: 1 },
      });
      if (result.rateLimited) break;
    }

    await prisma.catalogEngineRun.update({
      where: { id: run.id },
      data: {
        status: result.rateLimited ? "RATE_LIMITED" : "COMPLETED",
        found: result.found,
        imported: result.imported,
        updated: result.updated,
        enriched: result.enriched,
        skipped: result.skipped,
        failed: result.failed,
        message: JSON.stringify({ rateLimited: result.rateLimited, retryAfterMs: result.retryAfterMs, samples: result.samples }),
        finishedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.catalogEngineRun.update({ where: { id: run.id }, data: { status: "FAILED", failed: result.failed + 1, message: error instanceof Error ? error.message : "Unknown error", finishedAt: new Date() } });
    throw error;
  }
}
