"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importEmbeddedWordstatFiles, importWordstatKeywords } from "@/lib/seo/keyword-engine";
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

export async function importWordstatCsvAction(formData: FormData) {
  const source = String(formData.get("source") ?? "wordstat").trim() || "wordstat";
  const replace = String(formData.get("replace") ?? "") === "on";
  let text = String(formData.get("csvText") ?? "").trim();
  const file = formData.get("csvFile");
  if (file && typeof file === "object" && "text" in file && typeof file.text === "function") {
    const uploadedText = await file.text();
    if (uploadedText.trim()) text = uploadedText;
  }
  if (!text) redirectWithResult({ ok: false, message: "CSV пустой. Вставь текст или загрузи файл Wordstat." });
  const result = await importWordstatKeywords(text, source, { replace });
  redirectWithResult({ ok: true, message: replace ? "Wordstat CSV пересобран с очисткой старых данных." : "Wordstat CSV импортирован и кластеризован.", result });
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
