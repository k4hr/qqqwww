import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const total = await prisma.movie.count();
  const withAlloha = await prisma.movie.count({ where: { allohaId: { not: null } } });
  const latest = await prisma.movie.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-5">Админка MARIOFILM</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Stat title="Карточек в базе" value={total} />
        <Stat title="С Alloha ID" value={withAlloha} />
        <Stat title="Без плеера" value={total - withAlloha} />
      </div>
      <div className="bg-white border border-mario-line p-5">
        <h2 className="text-xl font-bold mb-4">Последние карточки</h2>
        <div className="divide-y">
          {latest.map((movie) => (
            <div key={movie.id} className="py-3 flex justify-between gap-4 text-sm">
              <span>{movie.titleRu} ({movie.year})</span>
              <span className="text-neutral-500">{movie.allohaId ? `Alloha: ${movie.allohaId}` : "Плеер не подключен"}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 text-neutral-600 text-sm">Следующим шагом сюда добавим формы: добавить фильм по названию, импорт из TMDB/Kinopoisk, проверка Alloha, публикация/скрытие карточек.</p>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="bg-white border border-mario-line p-5"><div className="text-sm text-neutral-500">{title}</div><div className="text-4xl font-bold mt-2">{value}</div></div>;
}
