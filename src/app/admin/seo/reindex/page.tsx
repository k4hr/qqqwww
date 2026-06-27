import Link from "next/link";
import { generateYandexReindexList } from "@/lib/seo/yandex-reindex";
import { CopyReindexButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function AdminSeoReindexPage() {
  const list = await generateYandexReindexList();
  const generatedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Moscow",
  }).format(list.generatedAt);

  return (
    <div className="container admin-shell py-6 text-[#222]">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Список 150 URL для Яндекс Переобхода</h1>
          <p className="mt-1 text-neutral-600">
            Готовый список публичных страниц REDFILM: топовые /watch, новые /watch, похожие фильмы, коллекции и таксономия.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/seo" className="font-bold text-[#e50914]">SEO</Link>
          <Link href="/admin" className="font-bold text-[#e50914]">Назад</Link>
        </div>
      </div>

      <section className="admin-panel mb-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Stat title="Всего URL" value={list.total} />
          <Stat title="Сгенерировано" value={generatedAt} wide />
          {list.groups.map((group) => (
            <Stat key={group.name} title={group.name} value={group.urls.length} />
          ))}
        </div>
        <p className="mt-4 text-sm text-neutral-600">
          Дубли удалены. В список не попадают /admin, /api, /favorites, /history, sitemap и robots.
        </p>
      </section>

      <section className="admin-panel p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Готовый список для Яндекса</h2>
            <p className="mt-1 text-sm text-neutral-600">Комментарии-группы оставлены для ручной проверки перед отправкой.</p>
          </div>
          <CopyReindexButton text={list.text} />
        </div>
        <textarea
          readOnly
          rows={24}
          value={list.text}
          className="w-full rounded-xl border border-[#ddd] bg-white p-4 font-mono text-sm leading-relaxed text-[#111]"
        />
      </section>
    </div>
  );
}

function Stat({ title, value, wide = false }: { title: string; value: string | number; wide?: boolean }) {
  return (
    <div className={`admin-panel p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-[#e50914]">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
    </div>
  );
}
