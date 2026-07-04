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

export async function importVibixBrowserItemAction(formData: FormData) {
  const returnTo = stringValue(formData.get("returnTo"));
  const video = decodeVideo(formData.get("videoJson"));
  const sourceType = formData.get("sourceType") === "serial" ? "serial" : "movie";
  const sourceCategoryId = intValue(formData.get("sourceCategoryId"));
  const sourceCategoryLabel = stringValue(formData.get("sourceCategoryLabel"));
  if (!video) redirect(resultUrl({ ok: false, message: "Не удалось прочитать запись Vibix из формы." }, returnTo));

  const videoWithCategory = attachSourceCategory(video, sourceCategoryId, sourceCategoryLabel);
  const enrichment = await enrichBeforeImport(videoWithCategory, sourceType);
  if (enrichment.rateLimited) {
    redirect(resultUrl({ ok: false, message: enrichment.message, details: { attempts: enrichment.attempts, video: enrichment.video } }, returnTo));
  }

  const saved = await saveVibixVideo(enrichment.video, undefined, { forcePublic: true, dirtyReason: "admin_vibix_manual_import" });
  const forceAnime = sourceCategoryId === VIBIX_CATEGORY_IDS.anime || sourceCategoryLabel?.toLocaleLowerCase("ru-RU").includes("аниме") === true || sourceCategoryLabel?.toLocaleLowerCase("ru-RU").includes("anime") === true;
  const savedMovieId = "movieId" in saved ? stringValue(saved.movieId) : null;

  if (forceAnime && savedMovieId) {
    await forceMovieToAnimeById(savedMovieId, "admin_vibix_browser_anime_import");
  }

  const movie = savedMovieId
    ? await prisma.movie.findUnique({ where: { id: savedMovieId }, select: { slug: true, titleRu: true, year: true, isPublicVisible: true, isCatalogAllowed: true, posterUrl: true, vibixIframeUrl: true, vibixEmbedCode: true } })
    : null;

  revalidatePath("/");
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  if (movie?.slug) revalidatePath(`/watch/${movie.slug}`);

  const title = movie?.titleRu || stringValue(enrichment.video.name_rus) || stringValue(enrichment.video.name) || stringValue(enrichment.video.name_original) || `Vibix ${enrichment.video.id ?? ""}`;
  redirect(resultUrl({
    ok: saved.status !== "skipped",
    message: saved.status === "skipped" ? `Не добавлено: ${saved.reason}` : `Добавлено/обновлено: ${title}`,
    details: { saved, movie, watchUrl: movie?.slug ? `/watch/${movie.slug}` : null, sourceCategoryId, sourceCategoryLabel, attempts: enrichment.attempts, video: enrichment.video },
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
  const ids = Array.from(new Set(decodeMovieIds(formData.get("movieIds")))).slice(0, 200);
  if (!ids.length) redirect(resultUrl({ ok: false, message: "На этой странице нет фильмов для переноса в аниме." }));

  const result = await forceMoviesToAnimeByIds(ids, "admin_vibix_page_anime_reclassify");

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  revalidatePath("/films");
  revalidatePath("/anime");
  redirect(resultUrl({ ok: true, message: `Перенесено в аниме с текущей страницы Vibix: ${result.moved}.`, details: result }));
}

