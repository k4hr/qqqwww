import { NextResponse } from "next/server";
import { findOrCreateTelegramUser } from "@/lib/telegram/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { initData?: string } | null;
  const initData = body?.initData?.trim() || "";

  if (!initData) {
    return NextResponse.json({ ok: true, user: null, guest: true });
  }

  const user = await findOrCreateTelegramUser(initData);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Invalid Telegram initData" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
    },
  });
}
