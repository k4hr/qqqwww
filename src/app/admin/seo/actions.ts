"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importEmbeddedWordstatFiles, importWordstatKeywords } from "@/lib/seo/keyword-engine";

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/seo");
  revalidatePath("/sitemap-index.xml");
  revalidatePath("/sitemaps/collections.xml");
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
