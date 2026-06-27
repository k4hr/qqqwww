"use client";

import { useEffect } from "react";
import { useTelegramSession } from "@/components/tg/telegram-provider";

export function TgWatchTracker({ movieId }: { movieId: string }) {
  const { initData, user } = useTelegramSession();

  useEffect(() => {
    if (!initData || !user) return;
    fetch("/api/tg/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData, movieId, progressSeconds: 0 }),
    }).catch(() => null);
  }, [initData, user, movieId]);

  return null;
}
