import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SimilarityRecalculateControls } from "./SimilarityRecalculateControls";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminSimilarityPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() || "Мстители: Война бесконечности";
  const [movies, links, topSources, samples] = await Promise.all([
    prisma.movie.count({ where: { isPublished: true, vibixAvailable: true } }),
    prisma.movieSimilarity.count(),
    prisma.movieSimilarity.findMany({ select: { sourceMovieId: true }, distinct: ["sourceMovieId"], take: 1 }).catch(() => []),
    prisma.movieSimilarity.findMany({ orderBy: { score: "desc" }, take: 10 }).catch(() => []),
  ]);

  return (
    <div className="container admin-shell py-6 text-[#222]">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Similarity Engine</h1>
          <p className="mt-1 text-neutral-600">Смысловые похожие фильмы: франшизы, темы, сюжетный вайб, аудитория.</p>
        </div>
        <Link href="/admin" className="font-bold text-[#e50914]">Назад</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Доступно в Vibix" value={movies} />
        <Stat title="Связей похожести" value={links} />
        <Stat title="Источников с кешем" value={topSources.length ? "есть" : "нет"} />
        <Stat title="Топ связей" value={samples.length} />
      </div>

      <section className="admin-panel mb-5 p-5">
        <h2 className="text-xl font-black">Пересчёт похожих</h2>
        <p className="mt-2 text-sm text-neutral-600">Кнопка считает похожие фильмы заранее и сохраняет их в MovieSimilarity. Для всей базы лучше запускать батчами, чтобы не упереться в timeout.</p>
        <SimilarityRecalculateControls />
        <p className="mt-3 text-sm text-neutral-500">Для полного фонового прогона через Railway console: <code>npm run similarity:recalculate</code></p>
      </section>

      <section className="admin-panel mb-5 p-5">
        <h2 className="text-xl font-black">Диагностика похожести</h2>
        <p className="mt-2 text-sm text-neutral-600">Введи название/slug/id фильма и открой JSON. Там будет видно, почему каждый фильм попал в похожие.</p>
        <form className="mt-4 flex flex-col gap-3 md:flex-row" action="/admin/similarity">
          <input name="q" defaultValue={q} className="min-h-11 flex-1 rounded-lg border border-[#ddd] bg-white px-3 text-[#222]" />
          <button className="rounded-lg bg-[#333] px-5 py-3 font-bold text-white" type="submit">Поставить пример</button>
          <a className="rounded-lg bg-[#e50914] px-5 py-3 font-bold text-white" href={`/api/admin/similarity/debug?q=${encodeURIComponent(q)}&limit=30`} target="_blank">Открыть debug JSON</a>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Мстители: Война бесконечности','Анчартед','Гарри Поттер','Форсаж','Терминатор','Аватар'].map((item) => (
            <Link key={item} href={`/admin/similarity?q=${encodeURIComponent(item)}`} className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">{item}</Link>
          ))}
        </div>
      </section>

      <section className="admin-panel p-5">
        <h2 className="mb-3 text-xl font-black">Лучшие сохранённые связи</h2>
        <div className="space-y-2 text-sm text-neutral-700">
          {samples.length ? samples.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#eee] bg-white p-3">
              <b>{item.score.toFixed(0)}</b> · source={item.sourceMovieId} · target={item.targetMovieId} · {item.bucket || '—'}
            </div>
          )) : <div className="rounded-lg border border-[#eee] p-3 text-neutral-500">Кеш похожих пока пустой. Нажми пересчёт или используй on-the-fly выдачу.</div>}
        </div>
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className="mt-2 text-2xl font-bold text-[#e50914]">{value}</div></div>;
}
