import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { refreshMissingPosters, toggleMoviePublished } from "./actions";
import { getContentTypeLabel } from "@/lib/content";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ posterUpdated?: string; posterSkipped?: string; posterFailed?: string; posterError?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const posterResult = await searchParams;
  const [total, published, withVibix, latest] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { isPublished: true } }),
    prisma.movie.count({ where: vibixPublicMovieWhere }),
    prisma.movie.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  return (
    <div className="container admin-shell py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-[#222]">Админка REDFILM</h1>
          <p className="text-neutral-600 mt-1">Управление карточками, импортом и будущим подключением плеера.</p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:[&>a]:w-full max-sm:[&>a]:justify-center">
          <Link href="/admin/new" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">Добавить вручную</Link>
          <Link href="/admin/import" className="bg-[#333] text-white font-bold px-5 py-3 rounded-sm">Импорт</Link>
          <Link href="/admin/bulk" className="bg-[#c9a86a] text-[#0b1020] font-bold px-5 py-3 rounded-sm">Массовый импорт</Link>
          <Link href="/admin/vibix" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">Vibix</Link>
          <Link href="/admin/catalog" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">КАТАЛОГ</Link>
          <Link href="/admin/ads" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">РЕКЛАМА</Link>
          <Link href="/admin/similarity" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">Похожие</Link>
          <Link href="/admin/seo" className="bg-[#e50914] text-white font-bold px-5 py-3 rounded-sm">SEO</Link>
          <Link href="/admin/trends" className="bg-[#333] text-white font-bold px-5 py-3 rounded-sm">Trend Engine</Link>
          <Link href="/admin/analytics" className="bg-[#333] text-white font-bold px-5 py-3 rounded-sm">Аналитика</Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Всего карточек" value={total} />
        <Stat title="Опубликовано" value={published} />
        <Stat title="Доступно в Vibix" value={withVibix} />
        <Stat title="Без Vibix-плеера" value={total - withVibix} />
      </div>

      <section className="admin-panel mb-6 p-5">
        <h2 className="text-xl font-bold text-[#222]">Постеры Vibix</h2>
        <p className="mt-2 text-sm text-neutral-600">Ручная последовательная подкачка только по точным KP/IMDb ID. Публичные страницы и sync worker её не запускают.</p>
        {posterResult.posterError === "missing_key" ? <p className="mt-3 font-semibold text-red-700">VIBIX_API_KEY не настроен.</p> : null}
        {posterResult.posterUpdated !== undefined ? <p className="mt-3 text-sm text-neutral-700">Обновлено: {posterResult.posterUpdated}; пропущено: {posterResult.posterSkipped ?? 0}; ошибок: {posterResult.posterFailed ?? 0}.</p> : null}
        <form action={refreshMissingPosters} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold text-[#333]">Записей за запуск
            <input name="limit" type="number" min="1" max="50" defaultValue="20" className="h-11 w-28 rounded-lg border border-[#d4d4d4] bg-white px-3 text-[#222]" />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#e50914] px-5 py-2 font-bold text-white">Докачать постеры</button>
        </form>
      </section>

      <div className="admin-panel p-5">
        <h2 className="text-xl font-bold mb-4 text-[#222]">Последние карточки</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[#222]">
            <thead className="text-left text-neutral-500 border-b border-[#e5e5e5]">
              <tr>
                <th className="py-3 pr-4">Название</th>
                <th className="py-3 pr-4">Тип</th>
                <th className="py-3 pr-4">Год</th>
                <th className="py-3 pr-4">Плеер</th>
                <th className="py-3 pr-4">Статус</th>
                <th className="py-3 pr-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee]">
              {latest.map((movie) => (
                <tr key={movie.id}>
                  <td className="py-3 pr-4 font-medium"><Link className="hover:text-[#e50914]" href={`/movie/${movie.slug}`}>{movie.titleRu}</Link></td>
                  <td className="py-3 pr-4">{getContentTypeLabel(movie.type)}</td>
                  <td className="py-3 pr-4">{movie.year}</td>
                  <td className="py-3 pr-4 text-neutral-500">{movie.vibixIframeUrl || movie.vibixEmbedCode ? "Vibix" : "нет"}</td>
                  <td className="py-3 pr-4">{movie.isPublished ? "Опубликовано" : "Скрыто"}</td>
                  <td className="py-3 pr-4">
                    <form action={toggleMoviePublished}>
                      <input type="hidden" name="id" value={movie.id} />
                      <input type="hidden" name="isPublished" value={String(movie.isPublished)} />
                      <button className="border border-[#ddd] rounded-xl px-3 py-1 hover:bg-[#f5f5f5]" type="submit">
                        {movie.isPublished ? "Скрыть" : "Опубликовать"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="admin-panel p-5"><div className="text-neutral-500 text-sm">{title}</div><div className="text-4xl font-bold mt-2 text-[#e50914]">{value}</div></div>;
}
