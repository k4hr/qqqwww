import type { Movie } from "@prisma/client";
import { getTelegramMiniAppUrl } from "@/lib/telegram/config";
import { miniAppSimilarUrl, miniAppWatchUrl } from "@/lib/telegram/deeplink";
import { siteUrl, watchPath } from "@/lib/seo-links";

export function webAppButton(text: string, url: string) {
  return { text, web_app: { url } };
}

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [webAppButton("Открыть REDFILM", getTelegramMiniAppUrl())],
      [
        { text: "Популярное", callback_data: "popular" },
        { text: "Новинки", callback_data: "latest" },
      ],
      [
        { text: "Поиск", callback_data: "search" },
        webAppButton("Избранное", getTelegramMiniAppUrl("/favorites")),
      ],
    ],
  };
}

export function movieKeyboard(movie: Pick<Movie, "slug">, withSimilar = true) {
  return {
    inline_keyboard: [
      [webAppButton("Смотреть в Telegram", miniAppWatchUrl(movie.slug))],
      [{ text: "Открыть на сайте", url: siteUrl(watchPath(movie)) }],
      ...(withSimilar ? [[webAppButton("Похожие", miniAppSimilarUrl(movie.slug))]] : []),
    ],
  };
}
