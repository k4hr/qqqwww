import { NextResponse } from "next/server";
import type { Movie } from "@prisma/client";
import { answerCallbackQuery, sendMessage } from "@/lib/telegram/bot";
import { getTelegramWebhookSecret } from "@/lib/telegram/config";
import { mainMenuKeyboard, movieKeyboard } from "@/lib/telegram/keyboards";
import { EMPTY_SEARCH_MESSAGE, movieResultText, START_MESSAGE } from "@/lib/telegram/messages";
import { getTgLatestMovies, getTgPopularMovies, searchTgMovies } from "@/lib/telegram/movies";
import { upsertTelegramUser, type TelegramInitUser } from "@/lib/telegram/auth";

export const dynamic = "force-dynamic";

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number | string };
  from?: TelegramInitUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: TelegramInitUser;
  message?: { chat: { id: number | string } };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function isWebhookAuthorized(request: Request) {
  const secret = getTelegramWebhookSecret();
  if (!secret) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
}

async function rememberUser(from?: TelegramInitUser) {
  if (!from?.id) return null;
  return upsertTelegramUser(from).catch(() => null);
}

async function sendMovieResults(chatId: number | string, movies: Pick<Movie, "slug" | "titleRu" | "titleOriginal" | "year" | "type" | "kpRating" | "imdbRating" | "quality">[]) {
  if (!movies.length) {
    await sendMessage(chatId, EMPTY_SEARCH_MESSAGE, { reply_markup: mainMenuKeyboard() });
    return;
  }

  for (const movie of movies.slice(0, 5)) {
    await sendMessage(chatId, movieResultText(movie), { reply_markup: movieKeyboard(movie) });
  }
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id;
  const user = await rememberUser(message.from);
  const text = message.text?.trim() || "";

  if (!text || text.startsWith("/start")) {
    await sendMessage(chatId, START_MESSAGE, { reply_markup: mainMenuKeyboard() });
    return;
  }

  const movies = await searchTgMovies(text, 5, user);
  await sendMovieResults(chatId, movies);
}

async function handleCallback(callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat.id;
  await rememberUser(callback.from);
  await answerCallbackQuery(callback.id);
  if (!chatId) return;

  if (callback.data === "popular") {
    const movies = await getTgPopularMovies(5);
    await sendMovieResults(chatId, movies);
    return;
  }

  if (callback.data === "latest") {
    const movies = await getTgLatestMovies(5);
    await sendMovieResults(chatId, movies);
    return;
  }

  if (callback.data === "search") {
    await sendMessage(chatId, "Напишите название фильма или сериала одним сообщением.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  await sendMessage(chatId, START_MESSAGE, { reply_markup: mainMenuKeyboard() });
}

export async function POST(request: Request) {
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  if (!update) return NextResponse.json({ ok: true });

  try {
    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
  } catch (error) {
    console.error("[telegram webhook] failed", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ ok: true, route: "telegram webhook" });
}
