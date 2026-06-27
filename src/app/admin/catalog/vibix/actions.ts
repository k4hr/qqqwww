"use server";

import { ContentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateCatalogScore } from "@/lib/catalog-score";
import { calculateHomeQuality } from "@/lib/home-quality-score";
import { prisma } from "@/lib/prisma";
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

function resultUrl(result: unknown) {
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  return `/admin/catalog/vibix?result=${encoded}`;
}

async function enrichBeforeImport(base: VibixVideo, sourceType: VibixCatalogType) {
  let enriched = { ...base };
  const attempts: string[] = [];
  const kpId = stringValue(enriched.kp_id) || stringValue(enriched.kinopoisk_id);
  const imdbId = stringValue(enriched.imdb_id);
  const vibixId = intValue(enriched.id);

  if (kpId) {
    const lookup = await getVibixVideoByKpIdResult(kpId);
    attempts.push(`kp:${kpId}:${lookup.video ? "found" : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found"}`);
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on KP lookup" };
    if (lookup.video) enriched = mergeVibixRecords(enriched, lookup.video);
  }

  if (imdbId) {
    const lookup = await getVibixVideoByImdbIdResult(imdbId);
    attempts.push(`imdb:${imdbId}:${lookup.video ? "found" : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found"}`);
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on IMDb lookup" };
    if (lookup.video) enriched = mergeVibixRecords(enriched, lookup.video);
  }

  if (vibixId !== null) {
    const lookup = await getVibixVideoByVibixIdResult(vibixId, { type: sourceType });
    attempts.push(...lookup.attempts.map((attempt) => `id:${vibixId}:${attempt}`));
    if (lookup.rateLimited) return { video: enriched, attempts, rateLimited: true as const, message: "Vibix rate limit on Vibix ID lookup" };
    if (lookup.video) enriched = mergeVibixRecords(enriched, lookup.video);
  }

  return { video: enriched, attempts, rateLimited: false as const, message: null };
}

export async function importVibixBrowserItemAction(formData: FormData) {
  const video = decodeVideo(formData.get("videoJson"));
  const sourceType = formData.get("sourceType") === "serial" ? "serial" : "movie";
  const sourceCategoryId = intValue(formData.get("sourceCategoryId"));
  const sourceCategoryLabel = stringValue(formData.get("sourceCategoryLabel"));
  if (!video) redirect(resultUrl({ ok: false, message: "Не удалось прочитать запись Vibix из формы." }));

  const videoWithCategory = attachSourceCategory(video, sourceCategoryId, sourceCategoryLabel);
  const enrichment = await enrichBeforeImport(videoWithCategory, sourceType);
  if (enrichment.rateLimited) {
    redirect(resultUrl({ ok: false, message: enrichment.message, details: { attempts: enrichment.attempts, video: enrichment.video } }));
  }

  const saved = await saveVibixVideo(enrichment.video);
  const movie = "movieId" in saved
    ? await prisma.movie.findUnique({ where: { id: saved.movieId }, select: { slug: true, titleRu: true, year: true, isPublicVisible: true, isCatalogAllowed: true, posterUrl: true, vibixIframeUrl: true, vibixEmbedCode: true } })
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
  }));
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

  const movies = await prisma.movie.findMany({
    where: { id: { in: ids } },
    include: { genres: { include: { genre: true } } },
  });

  let moved = 0;
  const examples: Array<{ title: string; year: number; slug: string }> = [];
  for (const movie of movies) {
    if (movie.type === ContentType.ANIME) continue;
    const typedMovie = { ...movie, type: ContentType.ANIME };
    const homeScore = calculateHomeQuality(typedMovie);
    const catalogScore = calculateCatalogScore(typedMovie);
    await prisma.movie.update({
      where: { id: movie.id },
      data: {
        type: ContentType.ANIME,
        ...homeScore,
        ...catalogScore,
        lastQualitySyncAt: new Date(),
        lastCatalogScoreAt: new Date(),
        similarityDirty: true,
        similarityDirtyReason: "admin_vibix_page_anime_reclassify",
      },
    });
    moved += 1;
    if (examples.length < 12) examples.push({ title: movie.titleRu, year: movie.year, slug: movie.slug });
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  revalidatePath("/films");
  revalidatePath("/anime");
  redirect(resultUrl({ ok: true, message: `Перенесено в аниме с текущей страницы Vibix: ${moved}.`, details: { requested: ids.length, moved, examples } }));
}

