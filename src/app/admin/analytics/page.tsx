import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RankedMovie = { id: string; titleRu: string; score: number };

async function movieRanking(since: Date): Promise<RankedMovie[]> {
  const rows = await prisma.movieEvent.groupBy({
    by: ["movieId", "type"],
    where: { movieId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const weights: Record<string, number> = { page_view: 1, player_view: 3, watch_click: 2, card_click: 2, similar_click: 1 };
  const scores = new Map<string, number>();
  for (const row of rows) if (row.movieId) scores.set(row.movieId, (scores.get(row.movieId) ?? 0) + row._count._all * (weights[row.type] ?? 0));
  const top = [...scores].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const movies = await prisma.movie.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, titleRu: true } });
  const titles = new Map(movies.map((movie) => [movie.id, movie.titleRu]));
  return top.map(([id, score]) => ({ id, score, titleRu: titles.get(id) ?? "Удалённая карточка" }));
}

export default async function AnalyticsPage() {
  let available = true;
  let day: RankedMovie[] = [];
  let week: RankedMovie[] = [];
  let searches: Array<{ query: string; count: number; averageResults: number }> = [];
  let similarClicks = 0;
  try {
    const [dayRows, weekRows, searchRows, clickCount] = await Promise.all([
      movieRanking(new Date(Date.now() - 86_400_000)),
      movieRanking(new Date(Date.now() - 7 * 86_400_000)),
      prisma.searchEvent.groupBy({ by: ["query"], where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, _count: { _all: true }, _avg: { results: true }, orderBy: { _count: { query: "desc" } }, take: 30 }),
      prisma.movieEvent.count({ where: { type: "similar_click", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    ]);
    day = dayRows;
    week = weekRows;
    searches = searchRows.map((row) => ({ query: row.query, count: row._count._all, averageResults: row._avg.results ?? 0 }));
    similarClicks = clickCount;
  } catch {
    available = false;
  }

  return <div className="container admin-shell py-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-[#222]">Аналитика REDFILM</h1><p className="mt-1 text-neutral-600">Поведение пользователей без IP и персональных профилей.</p></div><Link href="/admin" className="rounded-lg bg-[#333] px-4 py-2 font-bold text-white">В админку</Link></div>
    {!available ? <section className="admin-panel p-5 text-[#222]"><h2 className="text-xl font-bold">Таблицы аналитики пока не применены</h2><p className="mt-2 text-neutral-600">Примените additive Prisma migration. Публичный сайт продолжает использовать рейтинг как fallback популярности.</p></section> : <>
      <div className="mb-6 grid gap-4 md:grid-cols-3"><Stat label="Событий перехода к похожим за 7 дней" value={similarClicks} /><Stat label="Поисковых фраз за 30 дней" value={searches.reduce((sum, item) => sum + item.count, 0)} /><Stat label="Фильмов в тренде за 7 дней" value={week.length} /></div>
      <div className="grid gap-6 xl:grid-cols-2"><Ranking title="Топ фильмов за 24 часа" rows={day} /><Ranking title="Топ фильмов за 7 дней" rows={week} /></div>
      <section className="admin-panel mt-6 overflow-x-auto p-5"><h2 className="mb-4 text-xl font-bold text-[#222]">Поисковые запросы за 30 дней</h2><table className="w-full min-w-[560px] text-sm text-[#222]"><thead><tr className="border-b text-left text-neutral-500"><th className="py-2">Запрос</th><th>Поисков</th><th>Средняя выдача</th><th>Сигнал</th></tr></thead><tbody>{searches.map((item) => <tr key={item.query} className="border-b border-[#eee]"><td className="py-3 font-semibold">{item.query}</td><td>{item.count}</td><td>{item.averageResults.toFixed(1)}</td><td>{item.count >= 3 && item.averageResults < 2 ? <span className="font-bold text-red-700">Высокий спрос, мало результатов</span> : "—"}</td></tr>)}</tbody></table></section>
    </>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="admin-panel p-5"><div className="text-sm text-neutral-500">{label}</div><div className="mt-2 text-4xl font-black text-[#e50914]">{value}</div></div>;
}

function Ranking({ title, rows }: { title: string; rows: RankedMovie[] }) {
  return <section className="admin-panel p-5"><h2 className="mb-4 text-xl font-bold text-[#222]">{title}</h2>{rows.length ? <ol className="space-y-2">{rows.map((movie, index) => <li key={movie.id} className="flex items-center justify-between gap-3 border-b border-[#eee] py-2 text-[#222]"><span>{index + 1}. {movie.titleRu}</span><b>{movie.score}</b></li>)}</ol> : <p className="text-neutral-500">Данных пока нет.</p>}</section>;
}
