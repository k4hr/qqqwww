"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTelegramSession } from "@/components/tg/telegram-provider";
import { TgMovieCard } from "@/components/tg/tg-movie-card";

type LibraryItem = { movie: React.ComponentProps<typeof TgMovieCard>["movie"] };

export function TgPersonalSections() {
  const { initData, user } = useTelegramSession();
  const [history, setHistory] = useState<LibraryItem[]>([]);
  const [favorites, setFavorites] = useState<LibraryItem[]>([]);

  useEffect(() => {
    if (!initData || !user) return;
    Promise.all([
      fetch("/api/tg/history", { headers: { "x-telegram-init-data": initData } }).then((response) => response.json()),
      fetch("/api/tg/favorites", { headers: { "x-telegram-init-data": initData } }).then((response) => response.json()),
    ]).then(([historyPayload, favoritePayload]) => {
      setHistory(historyPayload?.items ?? []);
      setFavorites(favoritePayload?.items ?? []);
    }).catch(() => null);
  }, [initData, user]);

  if (!user) return null;

  return (
    <>
      {history.length ? <PersonalBlock title="Продолжить просмотр" href="/history" items={history.slice(0, 3)} /> : null}
      {favorites.length ? <PersonalBlock title="Избранное" href="/favorites" items={favorites.slice(0, 3)} /> : null}
    </>
  );
}

function PersonalBlock({ title, href, items }: { title: string; href: string; items: LibraryItem[] }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        <Link href={href} className="text-xs font-bold text-[#ff4d55]">Все</Link>
      </div>
      <div className="space-y-3">{items.map((item) => <TgMovieCard key={item.movie.id} movie={item.movie} />)}</div>
    </section>
  );
}
