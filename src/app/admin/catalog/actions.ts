"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import {
  buildVibixCatalogIndexBatch,
  importMissingFromVibixIndex,
  refreshVibixCatalogAudit,
  refreshVibixCatalogSnapshots,
  refreshVibixReferences,
} from "@/lib/vibix-catalog/catalog-audit";
import type { VibixCatalogType } from "@/lib/vibix";

function numberField(formData: FormData, name: string, fallback: number, min: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(min, Math.min(Math.trunc(value), max)) : fallback;
}

function optionalNumberField(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function sourceTypeField(formData: FormData): VibixCatalogType {
  return formData.get("sourceType") === "serial" ? "serial" : "movie";
}

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/catalog");
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  redirect(`/admin/catalog?result=${encoded}`);
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

export async function importMissingFromVibixAction(formData: FormData) {
  const sourceRaw = formData.get("sourceType");
  const sourceType = sourceRaw === "both" ? "both" : sourceTypeField(formData);
  const categoryId = optionalNumberField(formData, "categoryId");
  const result = await importMissingFromVibixIndex({
    sourceType,
    categoryId,
    limit: numberField(formData, "limit", 50, 1, 200),
  });
  redirectWithResult({ ok: result.failed === 0, message: `Догрузка: импорт ${result.imported}, обновлено ${result.updated}, пропущено ${result.skipped}, ошибок ${result.failed}.`, details: result });
}

export async function recalculateCatalogKindsAction() {
  const result = await recalculateAllCatalogScores();
  redirectWithResult({ ok: result.errors === 0, message: `Каталог пересчитан: ${result.processed}; публичных ${result.publicVisible}; ошибок ${result.errors}.`, details: result });
}
