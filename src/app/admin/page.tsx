import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleMoviePublished } from "./actions";
import { getContentTypeLabel } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [total, published, withAlloha, latest] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { isPublished: true } }),
    prisma.movie.count({ where: { allohaId: { not: null } } }),
    prisma.movie.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold">Админка MARIOFILM</h1>
          <p className="text-neutral-600 mt-1">Управление карточками, импортом и будущим подключением плеера.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/new" className="bg-mario-green text-white font-bold px-5 py-3 rounded-sm">Добавить вручную</Link>
          <Link href="/admin/import" className="bg-mario-dark text-white font-bold px-5 py-3 rounded-sm">Импорт TMDB</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Stat title="Всего карточек" value={total} />
        <Stat title="Опубликовано" value={published} />
        <Stat title="С Alloha ID" value={withAlloha} />
        <Stat title="Без плеера" value={total - withAlloha} />
      </div>

      <div className="bg-white border border-mario-line p-5">
        <h2 className="text-xl font-bold mb-4">Последние карточки</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500 border-b">
              <tr>
                <th className="py-3 pr-4">Название</th>
                <th className="py-3 pr-4">Тип</th>
                <th className="py-3 pr-4">Год</th>
                <th className="py-3 pr-4">Плеер</th>
                <th className="py-3 pr-4">Статус</th>
                <th className="py-3 pr-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {latest.map((movie) => (
                <tr key={movie.id}>
                  <td className="py-3 pr-4 font-medium"><Link className="hover:text-mario-green" href={`/movie/${movie.slug}`}>{movie.titleRu}</Link></td>
                  <td className="py-3 pr-4">{getContentTypeLabel(movie.type)}</td>
                  <td className="py-3 pr-4">{movie.year}</td>
                  <td className="py-3 pr-4 text-neutral-500">{movie.allohaId ? `Alloha: ${movie.allohaId}` : "нет"}</td>
                  <td className="py-3 pr-4">{movie.isPublished ? "Опубликовано" : "Скрыто"}</td>
                  <td className="py-3 pr-4">
                    <form action={toggleMoviePublished}>
                      <input type="hidden" name="id" value={movie.id} />
                      <input type="hidden" name="isPublished" value={String(movie.isPublished)} />
                      <button className="border border-mario-line px-3 py-1 hover:bg-neutral-100" type="submit">
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
  return <div className="bg-white border border-mario-line p-5"><div className="text-sm text-neutral-500">{title}</div><div className="text-4xl font-bold mt-2">{value}</div></div>;
}
