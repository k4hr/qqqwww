"use client";

import { useEffect, useState } from "react";
import { useTelegramSession } from "@/components/tg/telegram-provider";
import { TgMovieCard } from "@/components/tg/tg-movie-card";

type LibraryItem = { movie: React.ComponentProps<typeof TgMovieCard>["movie"] };

export function TgLibraryList({ type }: { type: "favorites" | "history" }) {
  const { initData, user, loading } = useTelegramSession();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!initData || !user) {
      if (!loading) setReady(true);
      return;
    }
    fetch(`/api/tg/${type}`, { headers: { "x-telegram-init-data": initData } })
      .then((response) => response.json())
      .then((payload) => setItems(payload?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, [initData, user, loading, type]);

  if (loading || !ready) return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5 text-[#a1a1aa]">Загрузка...</div>;
  if (!user) return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5 text-[#a1a1aa]">Откройте REDFILM через Telegram Mini App, чтобы видеть личный список.</div>;
  if (!items.length) return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5 text-[#a1a1aa]">Пока пусто.</div>;

  return <div className="space-y-3">{items.map((item) => <TgMovieCard key={item.movie.id} movie={item.movie} />)}</div>;
}
