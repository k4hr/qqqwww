import { siteUrl } from "@/lib/seo-links";

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.trim() || "";
}

export function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
}

export function getTelegramMiniAppUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_URL || siteUrl("/tg")).replace(/\/$/, "");
  return `${base}${path ? `/${path.replace(/^\//, "")}` : ""}`;
}

export function getTelegramWebhookUrl() {
  return siteUrl("/api/telegram/webhook");
}

export function maskTelegramToken(token = getTelegramBotToken()) {
  if (!token) return "";
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}
