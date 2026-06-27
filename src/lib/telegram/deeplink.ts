import { getTelegramBotUsername, getTelegramMiniAppUrl } from "@/lib/telegram/config";

export function telegramBotLink(start = "") {
  const username = getTelegramBotUsername();
  const payload = start ? `?start=${encodeURIComponent(start)}` : "";
  return username ? `https://t.me/${username.replace(/^@/, "")}${payload}` : "";
}

export function miniAppWatchUrl(slug: string) {
  return getTelegramMiniAppUrl(`/watch/${slug}`);
}

export function miniAppSimilarUrl(slug: string) {
  return getTelegramMiniAppUrl(`/similar/${slug}`);
}
