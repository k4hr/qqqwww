"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncVibixVideos, VibixSyncAlreadyRunningError, type VibixSyncResult } from "@/lib/vibix-sync";

function numberField(formData: FormData, name: string, fallback: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), max)) : fallback;
}

function booleanField(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function resultUrl(result: VibixSyncResult) {
  const params = new URLSearchParams({
    imported: String(result.imported),
    updated: String(result.updated),
    skipped: String(result.skipped),
    errors: String(result.errors),
    pagesProcessed: String(result.pagesProcessed),
    totalFromVibix: String(result.totalFromVibix),
    rateLimited: result.rateLimited ? "1" : "0",
    message: result.message || "",
    skippedReasons: JSON.stringify(result.skippedReasons),
    skippedSamples: JSON.stringify(result.skippedSamples),
  });
  return `/admin/vibix?${params.toString()}`;
}

async function runSync(options: Parameters<typeof syncVibixVideos>[0]) {
  if (!process.env.VIBIX_API_KEY?.trim()) redirect("/admin/vibix?error=missing_key");

  let result: VibixSyncResult;
  try {
    result = await syncVibixVideos(options);
  } catch (error) {
    if (error instanceof VibixSyncAlreadyRunningError) redirect("/admin/vibix?error=already_running");
    console.error("[Vibix] Admin sync failed:", error);
    redirect("/admin/vibix?error=sync_failed");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/vibix");
  redirect(resultUrl(result));
}

export async function syncVibixQuickAction(formData: FormData) {
  const catalogType = formData.get("type") === "serial" ? "serial" : "movie";
  await runSync({
    mode: "quick",
    pages: numberField(formData, "pages", 5, 20),
    limit: numberField(formData, "limit", 50, 100),
    pageDelayMs: numberField(formData, "pageDelayMs", 2_000, 60_000),
    maxPagesPerRun: 20,
    types: [catalogType],
    existKpId: true,
    noAds: booleanField(formData, "noAds"),
    lgbt: booleanField(formData, "lgbt"),
  });
}

export async function syncVibixAllAction(formData: FormData) {
  await runSync({
    mode: "all",
    limit: 50,
    pageDelayMs: 2_000,
    maxPagesPerRun: 100,
    types: ["movie", "serial"],
    existKpId: null,
    noAds: booleanField(formData, "noAds"),
    lgbt: booleanField(formData, "lgbt"),
  });
}
