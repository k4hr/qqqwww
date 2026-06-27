"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  if (!video) redirect(resultUrl({ ok: false, message: "Не удалось прочитать запись Vibix из формы." }));

  const enrichment = await enrichBeforeImport(video, sourceType);
  if (enrichment.rateLimited) {
    redirect(resultUrl({ ok: false, message: enrichment.message, details: { attempts: enrichment.attempts, video: enrichment.video } }));
  }

  const saved = await saveVibixVideo(enrichment.video);
  revalidatePath("/");
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");

  const title = stringValue(enrichment.video.name_rus) || stringValue(enrichment.video.name) || stringValue(enrichment.video.name_original) || `Vibix ${enrichment.video.id ?? ""}`;
  redirect(resultUrl({
    ok: saved.status !== "skipped",
    message: saved.status === "skipped" ? `Не добавлено: ${saved.reason}` : `Добавлено/обновлено: ${title}`,
    details: { saved, attempts: enrichment.attempts, video: enrichment.video },
  }));
}
