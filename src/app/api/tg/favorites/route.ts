import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateTelegramUser } from "@/lib/telegram/auth";
import { compactTgMovie, tgMovieInclude } from "@/lib/telegram/movies";

export const dynamic = "force-dynamic";

async function requireUser(request: Request, bodyInitData?: string) {
  const initData = bodyInitData || request.headers.get("x-telegram-init-data") || "";
  const user = initData ? await findOrCreateTelegramUser(initData) : null;
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ ok: false, message: "Telegram auth required", items: [] }, { status: 401 });

  const items = await prisma.telegramFavorite.findMany({
    where: { telegramUserId: user.id },
    include: { movie: { include: tgMovieInclude } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ ok: true, items: items.map((item) => ({ id: item.id, createdAt: item.createdAt, movie: compactTgMovie(item.movie) })) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { initData?: string; movieId?: string; slug?: string } | null;
  const user = await requireUser(request, body?.initData);
  if (!user) return NextResponse.json({ ok: false, message: "Telegram auth required" }, { status: 401 });

  const movie = body?.movieId
    ? await prisma.movie.findUnique({ where: { id: body.movieId }, select: { id: true } })
    : body?.slug
      ? await prisma.movie.findUnique({ where: { slug: body.slug }, select: { id: true } })
      : null;
  if (!movie) return NextResponse.json({ ok: false, message: "Movie not found" }, { status: 404 });

  const existing = await prisma.telegramFavorite.findUnique({
    where: { telegramUserId_movieId: { telegramUserId: user.id, movieId: movie.id } },
  });

  if (existing) {
    await prisma.telegramFavorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, favorite: false });
  }

  await prisma.telegramFavorite.create({ data: { telegramUserId: user.id, movieId: movie.id } });
  return NextResponse.json({ ok: true, favorite: true });
}
