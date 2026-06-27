import { NextResponse } from "next/server";
import { findOrCreateTelegramUser } from "@/lib/telegram/auth";
import { searchTgMovies, toTgMovies } from "@/lib/telegram/movies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 12), 20));
  const initData = request.headers.get("x-telegram-init-data") || "";
  const user = initData ? await findOrCreateTelegramUser(initData).catch(() => null) : null;
  const movies = q ? await searchTgMovies(q, limit, user) : [];
  return NextResponse.json({ ok: true, items: toTgMovies(movies), count: movies.length });
}
