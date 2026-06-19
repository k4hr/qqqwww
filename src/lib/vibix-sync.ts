import { ContentType, type Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { getVibixVideoByImdbId, getVibixVideoByKpId, getVibixVideoLinks, type VibixVideo } from "@/lib/vibix";

export type VibixSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
};

type SyncOptions = {
  pages?: number;
  limit?: number;
};

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  const normalized = stringValue(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function contentType(value: unknown) {
  const normalized = stringValue(value)?.toLowerCase() ?? "";
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return ContentType.SERIES;
  if (["cartoon", "animation"].includes(normalized)) return ContentType.CARTOON;
  if (normalized === "anime") return ContentType.ANIME;
  return ContentType.MOVIE;
}

function videoData(video: VibixVideo) {
  const title = stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_eng);
  const year = intValue(video.year);
  const kinopoiskId = stringValue(video.kp_id);
  const imdbId = stringValue(video.imdb_id);
  const iframeUrl = stringValue(video.iframe_url);
  if (!title || !year || year < 1880 || year > 2200 || (!kinopoiskId && !imdbId) || !iframeUrl) return null;

  return {
    title,
    titleOriginal: stringValue(video.name_eng),
    year,
    kinopoiskId,
    imdbId,
    iframeUrl,
    posterUrl: stringValue(video.poster_url),
    quality: stringValue(video.quality) || "HD",
    type: contentType(video.type),
    vibixType: stringValue(video.type),
    vibixId: intValue(video.id),
    vibixUploadedAt: dateValue(video.uploaded_at),
  };
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

async function findExisting(kinopoiskId: string | null, imdbId: string | null) {
  const OR = [
    kinopoiskId ? { kinopoiskId } : null,
    imdbId ? { imdbId } : null,
  ].filter((item): item is { kinopoiskId: string } | { imdbId: string } => item !== null);
  return OR.length ? prisma.movie.findFirst({ where: { OR } }) : null;
}

async function saveVibixVideo(video: VibixVideo, targetMovieId?: string) {
  const data = videoData(video);
  if (!data) return "skipped" as const;
  const existing = targetMovieId
    ? await prisma.movie.findUnique({ where: { id: targetMovieId } })
    : await findExisting(data.kinopoiskId, data.imdbId);
  const syncedAt = new Date();

  if (existing) {
    await prisma.movie.update({
      where: { id: existing.id },
      data: {
        titleRu: data.title,
        titleOriginal: data.titleOriginal || undefined,
        year: data.year,
        type: data.type,
        posterUrl: data.posterUrl || undefined,
        quality: data.quality,
        kinopoiskId: data.kinopoiskId || undefined,
        imdbId: data.imdbId || undefined,
        vibixId: data.vibixId,
        vibixIframeUrl: data.iframeUrl,
        vibixAvailable: true,
        vibixType: data.vibixType,
        vibixUploadedAt: data.vibixUploadedAt,
        vibixLastSyncAt: syncedAt,
        isPublished: true,
      },
    });
    return "updated" as const;
  }

  await prisma.movie.create({
    data: {
      slug: await uniqueSlug(data.title, data.year),
      titleRu: data.title,
      titleOriginal: data.titleOriginal,
      description: `${data.title} (${data.year}) доступен для просмотра на REDFILM.`,
      year: data.year,
      type: data.type,
      posterUrl: data.posterUrl,
      quality: data.quality,
      kinopoiskId: data.kinopoiskId,
      imdbId: data.imdbId,
      vibixId: data.vibixId,
      vibixIframeUrl: data.iframeUrl,
      vibixAvailable: true,
      vibixType: data.vibixType,
      vibixUploadedAt: data.vibixUploadedAt,
      vibixLastSyncAt: syncedAt,
      isPublished: true,
    },
  });
  return "imported" as const;
}

export async function syncVibixVideos(options: SyncOptions = {}): Promise<VibixSyncResult> {
  const pages = Math.max(1, Math.min(options.pages ?? 5, 20));
  const limit = Math.max(1, Math.min(options.limit ?? 100, 100));
  const result: VibixSyncResult = { imported: 0, updated: 0, skipped: 0, errors: 0 };

  for (let page = 1; page <= pages; page += 1) {
    const videos = await getVibixVideoLinks({ page, limit });
    if (!videos.length) break;
    for (const video of videos) {
      try {
        const status = await saveVibixVideo(video);
        result[status] += 1;
      } catch (error) {
        result.errors += 1;
        console.warn("[Vibix] Failed to save video:", error instanceof Error ? error.message : error);
      }
    }
  }
  return result;
}

export async function ensureVibixPlayback(movie: Movie) {
  if (movie.vibixIframeUrl) return movie;
  let video = movie.kinopoiskId ? await getVibixVideoByKpId(movie.kinopoiskId) : null;
  if (!video && movie.imdbId) video = await getVibixVideoByImdbId(movie.imdbId);
  if (!video || !videoData(video)) return movie;
  await saveVibixVideo(video, movie.id);
  return (await prisma.movie.findUnique({ where: { id: movie.id } })) ?? movie;
}
