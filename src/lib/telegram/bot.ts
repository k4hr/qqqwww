import { getTelegramBotToken, getTelegramWebhookSecret, getTelegramWebhookUrl } from "@/lib/telegram/config";

type TelegramApiResponse<T> = { ok: true; result: T } | { ok: false; description?: string; error_code?: number };

export type TelegramReplyMarkup = {
  inline_keyboard?: Array<Array<Record<string, unknown>>>;
};

export async function telegramApi<T = unknown>(method: string, payload: Record<string, unknown> = {}) {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as TelegramApiResponse<T> | null;
  if (!response.ok || !data?.ok) {
    const message = data && "description" in data ? data.description : response.statusText;
    throw new Error(message || `Telegram API ${method} failed`);
  }
  return data.result;
}

export function sendMessage(chatId: string | number, text: string, options: Record<string, unknown> = {}) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function setTelegramWebhook() {
  const secret = getTelegramWebhookSecret();
  return telegramApi("setWebhook", {
    url: getTelegramWebhookUrl(),
    ...(secret ? { secret_token: secret } : {}),
    allowed_updates: ["message", "callback_query"],
  });
}

export function deleteTelegramWebhook() {
  return telegramApi("deleteWebhook", { drop_pending_updates: false });
}

export function getTelegramWebhookInfo() {
  return telegramApi("getWebhookInfo");
}
