"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import {
  buildVibixCatalogIndexBatch,
  buildVibixPlayableLinksIndexBatch,
  importMissingFromVibixIndex,
  refreshVibixCatalogAudit,
  refreshVibixCatalogSnapshots,
  refreshVibixReferences,
} from "@/lib/vibix-catalog/catalog-audit";
import type { VibixCatalogType } from "@/lib/vibix";
import { cancelVibixCatalogMagicJob, runVibixCatalogMagicJobIteration, startVibixCatalogMagicJob } from "@/lib/vibix-catalog/catalog-magic-sync";

function numberField(formData: FormData, name: string, fallback: number, min: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(min, Math.min(Math.trunc(value), max)) : fallback;
}

function optionalNumberField(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function optionalBooleanField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function optionalStringField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function sourceTypeField(formData: FormData): VibixCatalogType {
  return formData.get("sourceType") === "serial" ? "serial" : "movie";
}

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/catalog");
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  redirect(`/admin/catalog?result=${encoded}`);
}


export async function startVibixCatalogMagicAction() {
  const job = await startVibixCatalogMagicJob();
  redirectWithResult({ ok: true, message: `Волшебная загрузка запущена. Статус: ${job.status}, этап: ${job.currentStage}. Worker продолжит сам.`, details: job });
}

export async function restartVibixCatalogMagicAction() {
  const job = await startVibixCatalogMagicJob({ restart: true });
  redirectWithResult({ ok: true, message: `Волшебная загрузка создана заново. Статус: ${job.status}, этап: ${job.currentStage}.`, details: job });
}

export async function runVibixCatalogMagicOnceAction() {
  const result = await runVibixCatalogMagicJobIteration({ force: true });
  redirectWithResult(result);
}

export async function cancelVibixCatalogMagicAction() {
  const job = await cancelVibixCatalogMagicJob();
  redirectWithResult({ ok: true, message: job ? "Волшебная загрузка остановлена." : "Активной волшебной загрузки нет.", details: job });
}

export async function refreshVibixCatalogAuditAction() {
  redirectWithResult(await refreshVibixCatalogAudit());
}

export async function refreshVibixReferencesAction() {
  redirectWithResult(await refreshVibixReferences());
}

export async function refreshVibixTotalsAction() {
  redirectWithResult(await refreshVibixCatalogSnapshots());
}

export async function buildVibixIndexAction(formData: FormData) {
  const categoryId = optionalNumberField(formData, "categoryId");
  const result = await buildVibixCatalogIndexBatch({
    sourceType: sourceTypeField(formData),
    categoryId,
    startPage: numberField(formData, "startPage", 1, 1, 100_000),
    pages: numberField(formData, "pages", 5, 1, 50),
    limit: numberField(formData, "limit", 1000, 100, 1000),
  });
  redirectWithResult({ ok: result.failed === 0, message: `Индекс Vibix: страниц ${result.scannedPages}, kpId ${result.indexed}, ошибок ${result.failed}.`, details: result });
}


export async function buildVibixPlayableLinksIndexAction(formData: FormData) {
  const categoryId = optionalNumberField(formData, "categoryId");
  const filterKind = optionalStringField(formData, "filterKind");
  const filterId = optionalNumberField(formData, "filterId");
  const result = await buildVibixPlayableLinksIndexBatch({
    sourceType: sourceTypeField(formData),
    categoryId,
    filterKind: filterKind === "category" && categoryId ? "category" : filterKind,
    filterId: filterKind === "category" && categoryId ? categoryId : filterId,
    year: optionalNumberField(formData, "year"),
    startPage: numberField(formData, "startPage", 1, 1, 100_000),
    pages: numberField(formData, "pages", 10, 1, 100),
    existKpId: optionalBooleanField(formData, "existKpId"),
    noAds: optionalBooleanField(formData, "noAds"),
    lgbt: optionalBooleanField(formData, "lgbt"),
    useFields: formData.get("useFields") === "on",
  });
  redirectWithResult({ ok: result.failed === 0, message: `Playable /links индекс: страниц ${result.scannedPages}, записей ${result.indexed}, новых к догрузке ${result.missingImportable}, ошибок ${result.failed}.`, details: result });
}

export async function importMissingFromVibixAction(formData: FormData) {
  const sourceRaw = formData.get("sourceType");
  const sourceType = sourceRaw === "both" ? "both" : sourceTypeField(formData);
  const categoryId = optionalNumberField(formData, "categoryId");
  const result = await importMissingFromVibixIndex({
    sourceType,
    categoryId,
    limit: numberField(formData, "limit", 50, 1, 200),
  });
  redirectWithResult({ ok: result.failed === 0, message: `Догрузка: импорт ${result.imported}, обновлено ${result.updated}, пропущено ${result.skipped}, detail 404 ${result.detailMissing}, ошибок ${result.failed}.`, details: result });
}

export async function recalculateCatalogKindsAction() {
  const result = await recalculateAllCatalogScores();
  redirectWithResult({ ok: result.errors === 0, message: `Каталог пересчитан: ${result.processed}; публичных ${result.publicVisible}; ошибок ${result.errors}.`, details: result });
}
