"use client";

import { useEffect, useState } from "react";
import { useTelegramSession } from "@/components/tg/telegram-provider";

export function TgFavoriteButton({ movieId }: { movieId: string }) {
  const { initData, user, loading } = useTelegramSession();
  const [favorite, setFavorite] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!initData || !user) return;
    fetch("/api/tg/favorites", { headers: { "x-telegram-init-data": initData } })
      .then((response) => response.json())
      .then((payload) => {
        const exists = payload?.items?.some((item: { movie: { id: string } }) => item.movie.id === movieId);
        setFavorite(Boolean(exists));
      })
      .catch(() => null);
  }, [initData, user, movieId]);

  async function toggle() {
    if (!initData || !user || pending) return;
    setPending(true);
    const response = await fetch("/api/tg/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData, movieId }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (payload?.ok) setFavorite(Boolean(payload.favorite));
    setPending(false);
  }

  if (loading) return null;
  if (!user) return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3 text-sm text-[#a1a1aa]">Избранное доступно при открытии через Telegram.</div>;

  return (
    <button onClick={toggle} disabled={pending} className={`min-h-11 rounded-2xl px-4 text-sm font-black ${favorite ? "bg-[#e50914] text-white" : "bg-white text-[#09090d]"}`}>
      {favorite ? "В избранном" : "В избранное"}
    </button>
  );
}
