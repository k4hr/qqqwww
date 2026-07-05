"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { forceMovieToAnimeById, forceMoviesToAnimeByIds } from "@/lib/admin-anime-tools";
import { prisma } from "@/lib/prisma";
import { VIBIX_CATEGORY_IDS } from "@/lib/vibix-catalog/vibix-taxonomy-ids";
import {
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpIdResult,
  getVibixVideoByVibixIdResult,
  type VibixCatalogType,
  type VibixVideo,
} from "@/lib/vibix";
import { mergeVibixRecords, saveVibixVideo } from "@/lib/vibix-sync";

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function decodeVideo(value: FormDataEntryValue | null): VibixVideo | null {
  const encoded = stringValue(value);
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VibixVideo;
  } catch {
    return null;
  }
}


function attachSourceCategory(video: VibixVideo, categoryId: number | null, categoryLabel: string | null): VibixVideo {
  if (!categoryId) return video;
  const record = video as VibixVideo & Record<string, unknown>;
  const category = { id: categoryId, category_id: categoryId, name: categoryLabel ?? undefined, name_rus: categoryLabel ?? undefined };
  return {
    ...record,
    category_id: record.category_id ?? categoryId,
    category: record.category ?? category,
    categories: record.categories ?? [category],
  } as VibixVideo;
}

function normalizedKpId(video: VibixVideo) {
  return stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
}

function normalizedImdbId(video: VibixVideo) {
  return stringValue(video.imdb_id);
}

function normalizedTitle(video: VibixVideo) {
  return stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_original) || stringValue(video.name_eng);
}

function isSameVibixTitle(source: VibixVideo, candidate: VibixVideo) {
  const sourceKp = normalizedKpId(source);
  const candidateKp = normalizedKpId(candidate);
  if (sourceKp && candidateKp) return sourceKp === candidateKp;

  const sourceImdb = normalizedImdbId(source);
  const candidateImdb = normalizedImdbId(candidate);
  if (sourceImdb && candidateImdb) return sourceImdb === candidateImdb;

  const sourceId = intValue(source.id);
  const candidateId = intValue(candidate.id);
  if (sourceId !== null && candidateId !== null) return sourceId === candidateId;

  const sourceTitle = normalizedTitle(source)?.toLocaleLowerCase("ru-RU");
  const candidateTitle = normalizedTitle(candidate)?.toLocaleLowerCase("ru-RU");
  const sourceYear = intValue(source.year);
  const candidateYear = intValue(candidate.year);
  return Boolean(sourceTitle && candidateTitle && sourceTitle === candidateTitle && (!sourceYear || !candidateYear || sourceYear === candidateYear));
}

function canMergeLookup(source: VibixVideo, candidate: VibixVideo | null) {
  if (!candidate) return false;

  const sourceKp = normalizedKpId(source);
  const candidateKp = normalizedKpId(candidate);
  if (sourceKp && candidateKp && sourceKp !== candidateKp) return false;

  const sourceImdb = normalizedImdbId(source);
  const candidateImdb = normalizedImdbId(candidate);
  if (sourceImdb && candidateImdb && sourceImdb !== candidateImdb) return false;

  return isSameVibixTitle(source, candidate);
}

function resultUrl(result: unknown, returnTo?: string | null) {
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  const safeReturnTo = returnTo?.startsWith("/admin/catalog/vibix") ? returnTo : "/admin/catalog/vibix";
  const url = new URL(safeReturnTo, "https://redfilm.local");
  url.searchParams.set("result", encoded);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

async function enrichBeforeImport(base: VibixVideo, sourceType: VibixCatalogType) {
  let enriched = { ...base };
  const attempts: string[] = [];
  const baseHasExactPlayer = Boolean(stringValue(enriched.iframe_url) || stringValue(enriched.embed_code));

  // Important: manual Vibix browser rows already contain the exact clicked item.
  // If the row already has player data, do not perform a broad /id lookup: Vibix /id can
  // return another fresh item and overwrite the clicked title.
  if (baseHasExactPlayer) {
    attempts.push("base:player_ok");
    return { video: enriched, attempts, rateLimited: false as const, message: null };
  }

  const kpId = normalizedKpId(enriched);
  const imdbId = normalizedImdbId(enriched);
  const vibixId = intValue(enriched.id);

  if (kpId) {
    const lookup = await getVibixVideoByKpIdResult(kpId);
    const status = lookup.video ? (canMergeLookup(base, lookup.video) ? "found" : "mismatch") : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found";
    attempts.push(`kp:${kpId}:${status}`);
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on KP lookup" };
    if (lookup.video && canMergeLookup(base, lookup.video)) enriched = mergeVibixRecords(enriched, lookup.video);
  }

  if (!stringValue(enriched.iframe_url) && !stringValue(enriched.embed_code) && imdbId) {
    const lookup = await getVibixVideoByImdbIdResult(imdbId);
    const status = lookup.video ? (canMergeLookup(base, lookup.video) ? "found" : "mismatch") : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found";
    attempts.push(`imdb:${imdbId}:${status}`);
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on IMDb lookup" };
    if (lookup.video && canMergeLookup(base, lookup.video)) enriched = mergeVibixRecords(enriched, lookup.video);
  }

  if (!stringValue(enriched.iframe_url) && !stringValue(enriched.embed_code) && vibixId !== null) {
    const lookup = await getVibixVideoByVibixIdResult(vibixId, { type: sourceType });
    attempts.push(...lookup.attempts.map((attempt) => `id:${vibixId}:${attempt}`));
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on Vibix ID lookup" };
    if (lookup.video && canMergeLookup(base, lookup.video)) {
      attempts.push(`id:${vibixId}:matched`);
      enriched = mergeVibixRecords(enriched, lookup.video);
    } else if (lookup.video) {
      attempts.push(`id:${vibixId}:mismatch_skipped`);
    }
  }

  return { video: enriched, attempts, rateLimited: false as const, message: null };
}


type BrowserImportResult = {
  ok: boolean;
  rateLimited: boolean;
  status: "imported" | "updated" | "skipped" | "error";
  title: string;
  saved?: Awaited<ReturnType<typeof saveVibixVideo>>;
  movie?: {
    slug: string;
    titleRu: string;
    year: number;
    isPublicVisible: boolean;
    isCatalogAllowed: boolean;
    posterUrl: string | null;
    vibixIframeUrl: string | null;
    vibixEmbedCode: string | null;
  } | null;
  watchUrl?: string | null;
  sourceCategoryId: number | null;
  sourceCategoryLabel: string | null;
  attempts: string[];
  video: VibixVideo;
  message?: string | null;
  error?: string | null;
};

async function importVibixBrowserVideo(params: {
  video: VibixVideo;
  sourceType: VibixCatalogType;
  sourceCategoryId: number | null;
  sourceCategoryLabel: string | null;
  dirtyReason: string;
}): Promise<BrowserImportResult> {
  const videoWithCategory = attachSourceCategory(params.video, params.sourceCategoryId, params.sourceCategoryLabel);
  const fallbackTitle = normalizedTitle(videoWithCategory) || `Vibix ${videoWithCategory.id ?? ""}`;

  try {
    const enrichment = await enrichBeforeImport(videoWithCategory, params.sourceType);
    if (enrichment.rateLimited) {
      return {
        ok: false,
        rateLimited: true,
        status: "error",
        title: fallbackTitle,
        sourceCategoryId: params.sourceCategoryId,
        sourceCategoryLabel: params.sourceCategoryLabel,
        attempts: enrichment.attempts,
        video: enrichment.video,
        message: enrichment.message,
      };
    }

    const saved = await saveVibixVideo(enrichment.video, undefined, { forcePublic: true, dirtyReason: params.dirtyReason });
    const forceAnime = params.sourceCategoryId === VIBIX_CATEGORY_IDS.anime || params.sourceCategoryLabel?.toLocaleLowerCase("ru-RU").includes("аниме") === true || params.sourceCategoryLabel?.toLocaleLowerCase("ru-RU").includes("anime") === true;
    const savedMovieId = "movieId" in saved ? stringValue(saved.movieId) : null;

    if (forceAnime && savedMovieId) {
      await forceMovieToAnimeById(savedMovieId, params.dirtyReason);
    }

    const movie = savedMovieId
      ? await prisma.movie.findUnique({ where: { id: savedMovieId }, select: { slug: true, titleRu: true, year: true, isPublicVisible: true, isCatalogAllowed: true, posterUrl: true, vibixIframeUrl: true, vibixEmbedCode: true } })
      : null;

    const title = movie?.titleRu || stringValue(enrichment.video.name_rus) || stringValue(enrichment.video.name) || stringValue(enrichment.video.name_original) || fallbackTitle;
    return {
      ok: saved.status !== "skipped",
      rateLimited: false,
      status: saved.status,
      title,
      saved,
      movie,
      watchUrl: movie?.slug ? `/watch/${movie.slug}` : null,
      sourceCategoryId: params.sourceCategoryId,
      sourceCategoryLabel: params.sourceCategoryLabel,
      attempts: enrichment.attempts,
      video: enrichment.video,
      message: saved.status === "skipped" ? `Не добавлено: ${saved.reason}` : `Добавлено/обновлено: ${title}`,
    };
  } catch (error) {
    return {
      ok: false,
      rateLimited: false,
      status: "error",
      title: fallbackTitle,
      sourceCategoryId: params.sourceCategoryId,
      sourceCategoryLabel: params.sourceCategoryLabel,
      attempts: [],
      video: videoWithCategory,
      message: "Ошибка импорта Vibix записи.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function decodeVideos(value: FormDataEntryValue[]): VibixVideo[] {
  const videos: VibixVideo[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const raw = stringValue(item);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const video = decodeVideo(raw);
    if (video) videos.push(video);
  }
  return videos;
}

function revalidateVibixBrowserImport(paths: Array<string | null | undefined> = []) {
  revalidatePath("/");
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  for (const path of paths) {
    if (path) revalidatePath(path);
  }
}

export async function importVibixBrowserItemAction(formData: FormData) {
  const returnTo = stringValue(formData.get("returnTo"));
  const video = decodeVideo(formData.get("videoJson"));
  const sourceType = formData.get("sourceType") === "serial" ? "serial" : "movie";
  const sourceCategoryId = intValue(formData.get("sourceCategoryId"));
  const sourceCategoryLabel = stringValue(formData.get("sourceCategoryLabel"));
  if (!video) redirect(resultUrl({ ok: false, message: "Не удалось прочитать запись Vibix из формы." }, returnTo));

  const result = await importVibixBrowserVideo({
    video,
    sourceType,
    sourceCategoryId,
    sourceCategoryLabel,
    dirtyReason: "admin_vibix_manual_import",
  });

  revalidateVibixBrowserImport([result.watchUrl]);

  redirect(resultUrl({
    ok: result.ok,
    message: result.status === "skipped" ? result.message : result.message ?? `Добавлено/обновлено: ${result.title}`,
    details: {
      saved: result.saved,
      movie: result.movie,
      watchUrl: result.watchUrl,
      sourceCategoryId: result.sourceCategoryId,
      sourceCategoryLabel: result.sourceCategoryLabel,
      attempts: result.attempts,
      video: result.video,
      error: result.error,
    },
  }, returnTo));
}

export async function importVibixBrowserBulkAction(formData: FormData) {
  const returnTo = stringValue(formData.get("returnTo"));
  const sourceType = formData.get("sourceType") === "serial" ? "serial" : "movie";
  const sourceCategoryId = intValue(formData.get("sourceCategoryId"));
  const sourceCategoryLabel = stringValue(formData.get("sourceCategoryLabel"));
  const mode = stringValue(formData.get("bulkMode")) === "page" ? "page" : "selected";
  const videos = decodeVideos(formData.getAll(mode === "page" ? "allVideoJsons" : "selectedVideoJsons")).slice(0, 100);

  if (!videos.length) {
    redirect(resultUrl({
      ok: false,
      message: mode === "page" ? "На текущей странице нет записей с player для загрузки." : "Сначала отметь галочками тайтлы, которые нужно добавить.",
    }, returnTo));
  }

  const summary = {
    mode,
    requested: videos.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    rateLimited: false,
    items: [] as Array<{
      status: BrowserImportResult["status"];
      ok: boolean;
      title: string;
      watchUrl?: string | null;
      message?: string | null;
      error?: string | null;
      attempts?: string[];
    }>,
  };
  const revalidateWatchPaths: string[] = [];

  for (const video of videos) {
    const result = await importVibixBrowserVideo({
      video,
      sourceType,
      sourceCategoryId,
      sourceCategoryLabel,
      dirtyReason: mode === "page" ? "admin_vibix_page_bulk_import" : "admin_vibix_selected_bulk_import",
    });

    if (result.status === "imported") summary.imported += 1;
    else if (result.status === "updated") summary.updated += 1;
    else if (result.status === "skipped") summary.skipped += 1;
    else summary.errors += 1;

    if (result.watchUrl) revalidateWatchPaths.push(result.watchUrl);
    if (summary.items.length < 30) {
      summary.items.push({
        status: result.status,
        ok: result.ok,
        title: result.title,
        watchUrl: result.watchUrl,
        message: result.message,
        error: result.error,
        attempts: result.attempts,
      });
    }

    if (result.rateLimited) {
      summary.rateLimited = true;
      break;
    }
  }

  revalidateVibixBrowserImport(revalidateWatchPaths);

  const done = summary.imported + summary.updated;
  const failed = summary.skipped + summary.errors;
  redirect(resultUrl({
    ok: !summary.rateLimited && done > 0,
    message: summary.rateLimited
      ? `Vibix упёрся в rate limit. Успели загрузить/обновить: ${done}, пропущено/ошибок: ${failed}.`
      : `Готово. Загружено новых: ${summary.imported}, обновлено: ${summary.updated}, пропущено/ошибок: ${failed}.`,
    details: summary,
  }, returnTo));
}

function decodeMovieIds(value: FormDataEntryValue | null) {
  const raw = stringValue(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => stringValue(item)).filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

export async function moveVibixBrowserPageMoviesToAnimeAction(formData: FormData) {
  const returnTo = stringValue(formData.get("returnTo"));
  const ids = Array.from(new Set(decodeMovieIds(formData.get("movieIds")))).slice(0, 200);
  if (!ids.length) redirect(resultUrl({ ok: false, message: "На этой странице нет фильмов для переноса в аниме." }, returnTo));

  const result = await forceMoviesToAnimeByIds(ids, "admin_vibix_page_anime_reclassify");

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  revalidatePath("/films");
  revalidatePath("/anime");
  redirect(resultUrl({ ok: true, message: `Перенесено в аниме с текущей страницы Vibix: ${result.moved}.`, details: result }, returnTo));
}

