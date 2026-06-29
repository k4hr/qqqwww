"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applySeoLandingQualityGate, importEmbeddedWordstatFiles, importWordstatRows, parseWordstatCsv, rebuildStoredWordstatDemand } from "@/lib/seo/keyword-engine";
import { generateAiSeoLandingPage, generateTopAiSeoLandingPages } from "@/lib/seo/ai-builder";
import { runSeoAutopilot } from "@/lib/seo/autopilot";

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/seo");
  revalidatePath("/sitemap-index.xml");
  revalidatePath("/sitemaps/collections.xml");
  revalidatePath("/collections", "layout");
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  redirect(`/admin/seo?result=${encoded}`);
}

function isTextUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "text" in value &&
      typeof value.text === "function"
  );
}

export async function importWordstatCsvAction(formData: FormData) {
  const source = String(formData.get("source") ?? "wordstat").trim() || "wordstat";
  const replace = String(formData.get("replace") ?? "") === "on";
  const manualText = String(formData.get("csvText") ?? "").trim();
  const fileEntries = [
    ...formData.getAll("csvFiles"),
    ...formData.getAll("csvFile"),
  ].filter(isTextUpload);

  const uniqueFiles = fileEntries.filter((file, index, list) => {
    if (!file.name && file.size === 0) return false;
    return list.findIndex((item) => item.name === file.name && item.size === file.size) === index;
  });
  const selectedFiles = uniqueFiles.slice(0, 10);
  const skippedFiles = Math.max(0, uniqueFiles.length - selectedFiles.length);
  const rows = [] as ReturnType<typeof parseWordstatCsv>;
  const files: { name: string; size: number; rows: number }[] = [];

  for (const file of selectedFiles) {
    const text = (await file.text()).trim();
    if (!text) {
      files.push({ name: file.name || "без имени", size: file.size, rows: 0 });
      continue;
    }
    const parsedRows = parseWordstatCsv(text);
    rows.push(...parsedRows);
    files.push({ name: file.name || "без имени", size: file.size, rows: parsedRows.length });
  }

  let manualRows = 0;
  if (manualText) {
    const parsedRows = parseWordstatCsv(manualText);
    manualRows = parsedRows.length;
    rows.push(...parsedRows);
  }

  if (!rows.length) {
    redirectWithResult({
      ok: false,
      message: "CSV пустой. Выбери до 10 файлов Wordstat или вставь CSV текстом.",
      files,
      manualRows,
      skippedFiles,
    });
  }

  const result = await importWordstatRows(rows, source, { replace });
  const quality = await applySeoLandingQualityGate();
  redirectWithResult({
    ok: true,
    message: replace
      ? "Wordstat CSV-пакет пересобран с очисткой старых данных."
      : "Wordstat CSV-пакет импортирован и кластеризован.",
    files,
    fileCount: selectedFiles.length,
    skippedFiles,
    manualRows,
    result,
    quality,
  });
}

export async function rebuildEmbeddedWordstatAction() {
  const result = await importEmbeddedWordstatFiles({ replace: true });
  redirectWithResult({ ok: true, message: "Встроенные Wordstat CSV пересобраны без дублей.", result });
}


export async function generateAiSeoPageAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) redirectWithResult({ ok: false, message: "Не указан slug SEO-страницы." });
  try {
    const result = await generateAiSeoLandingPage(slug);
    revalidatePath(`/collections/${slug}`);
    redirectWithResult({ ok: true, message: `AI SEO-страница пересобрана: ${slug}`, result });
  } catch (error) {
    redirectWithResult({ ok: false, message: error instanceof Error ? error.message : String(error), slug });
  }
}

export async function generateTopAiSeoPagesAction(formData: FormData) {
  const limit = Number(formData.get("limit") ?? 10);
  try {
    const result = await generateTopAiSeoLandingPages(Number.isFinite(limit) ? limit : 10);
    redirectWithResult({ ok: true, message: "AI пересобрал SEO-страницы.", result });
  } catch (error) {
    redirectWithResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}

export async function runSeoAutopilotAction(formData: FormData) {
  const aiLimit = Number(formData.get("aiLimit") ?? 5);
  try {
    const result = await runSeoAutopilot({ aiLimit: Number.isFinite(aiLimit) ? aiLimit : 5, rebuildWordstat: true });
    revalidatePath("/admin/seo");
    revalidatePath("/sitemap-index.xml");
    revalidatePath("/sitemaps/collections.xml");
    redirectWithResult({ ok: true, message: "SEO Autopilot завершил сборку страниц.", result });
  } catch (error) {
    redirectWithResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}


export async function rebuildSeoDemandAction() {
  try {
    const result = await rebuildStoredWordstatDemand();
    revalidatePath("/admin/seo");
    revalidatePath("/sitemap-index.xml");
    revalidatePath("/sitemaps/collections.xml");
    redirectWithResult({ ok: true, message: "SEO Demand пересчитан: интенты, военные темы, подборки и Quality Gate обновлены.", result });
  } catch (error) {
    redirectWithResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
