"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteTelegramWebhook, getTelegramWebhookInfo, setTelegramWebhook } from "@/lib/telegram/bot";

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/telegram");
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  redirect(`/admin/telegram?result=${encoded}`);
}

export async function setTelegramWebhookAction() {
  try {
    const result = await setTelegramWebhook();
    redirectWithResult({ ok: true, action: "setWebhook", result });
  } catch (error) {
    redirectWithResult({ ok: false, action: "setWebhook", message: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteTelegramWebhookAction() {
  try {
    const result = await deleteTelegramWebhook();
    redirectWithResult({ ok: true, action: "deleteWebhook", result });
  } catch (error) {
    redirectWithResult({ ok: false, action: "deleteWebhook", message: error instanceof Error ? error.message : String(error) });
  }
}

export async function getTelegramWebhookInfoAction() {
  try {
    const result = await getTelegramWebhookInfo();
    redirectWithResult({ ok: true, action: "getWebhookInfo", result });
  } catch (error) {
    redirectWithResult({ ok: false, action: "getWebhookInfo", message: error instanceof Error ? error.message : String(error) });
  }
}
