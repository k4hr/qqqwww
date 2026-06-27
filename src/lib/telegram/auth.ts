import { createHmac, timingSafeEqual } from "crypto";
import type { TelegramUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTelegramBotToken } from "@/lib/telegram/config";

export type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type VerifiedTelegramInitData = {
  user: TelegramInitUser | null;
  authDate: Date | null;
};

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTelegramInitData(initData: string, botToken = getTelegramBotToken()): VerifiedTelegramInitData | null {
  if (!initData?.trim() || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(calculatedHash, hash)) return null;

  const authDateSeconds = Number(params.get("auth_date") ?? 0);
  const authDate = Number.isFinite(authDateSeconds) && authDateSeconds > 0 ? new Date(authDateSeconds * 1000) : null;
  if (authDate && Date.now() - authDate.getTime() > 7 * 24 * 60 * 60 * 1000) return null;

  const userJson = params.get("user");
  let user: TelegramInitUser | null = null;
  if (userJson) {
    try {
      const parsed = JSON.parse(userJson) as TelegramInitUser;
      if (parsed?.id) user = parsed;
    } catch {
      user = null;
    }
  }

  return { user, authDate };
}

export async function upsertTelegramUser(user: TelegramInitUser): Promise<TelegramUser> {
  return prisma.telegramUser.upsert({
    where: { telegramId: String(user.id) },
    create: {
      telegramId: String(user.id),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      lastSeenAt: new Date(),
    },
    update: {
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      lastSeenAt: new Date(),
    },
  });
}

export async function findOrCreateTelegramUser(initData: string) {
  const verified = verifyTelegramInitData(initData);
  if (!verified?.user) return null;
  return upsertTelegramUser(verified.user);
}

export async function telegramUserFromRequest(request: Request) {
  const initData = request.headers.get("x-telegram-init-data") || "";
  return findOrCreateTelegramUser(initData);
}
