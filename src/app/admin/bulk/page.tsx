import Link from "next/link";
import { bulkImportFromKinopoisk } from "../actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ created?: string; skipped?: string; failed?: string }> };

const collections = [
  { value: "TOP_POPULAR_MOVIES", label: "Популярные фильмы" },
  { value: "TOP_250_MOVIES", label: "ТОП 250 фильмов" },
  { value: "TOP_250_TV_SHOWS", label: "ТОП 250 сериалов" },
  { value: "CLOSES_RELEASES", label: "Ближайшие релизы" },
];

export default async function BulkImportPage({ searchParams }: Props) {
  const { created, skipped, failed } = await searchParams;
  const hasResult = created || skipped || failed;

  return (
    <div className="container py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в админку</Link>
      <h1 className="text-3xl font-bold mt-3 mb-2 text-[#222]">Массовый импорт</h1>
      <p className="text-neutral-600 mb-6 max-w-3xl">
        Импортирует сразу пачку карточек из подборок Kinopoisk API Unofficial. Дубли по Kinopoisk/TMDB/IMDb ID автоматически пропускаются.
      </p>

      {hasResult ? (
        <div className="vip-panel p-5 mb-6 grid md:grid-cols-3 gap-3">
          <Result title="Добавлено" value={created || "0"} />
          <Result title="Пропущено дублей" value={skipped || "0"} />
          <Result title="Ошибок" value={failed || "0"} />
        </div>
      ) : null}

      <form action={bulkImportFromKinopoisk} className="vip-panel p-5 grid md:grid-cols-2 gap-4 max-w-3xl">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold mb-2 text-[#333]">Что импортировать</label>
          <select name="collection" className="w-full rounded-xl border border-[#ddd] bg-white text-[#222] h-12 px-4 outline-none focus:border-[#e50914]">
            {collections.map((item) => (
              <option value={item.value} key={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        <Field label="Сколько страниц API" name="pages" defaultValue="1" helper="1 страница ≈ 20 фильмов. Больше 3 лучше не ставить из-за лимитов." />
        <Field label="Лимит карточек" name="limit" defaultValue="20" helper="Например 20, 40, 60. Максимум 100 за раз." />
        <Field label="Качество" name="quality" defaultValue="WEB-DL" className="md:col-span-2" />

        <button className="md:col-span-2 rounded-xl bg-gradient-to-r from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] font-bold h-12" type="submit">
          Запустить массовый импорт
        </button>
      </form>
    </div>
  );
}

function Field({ label, name, defaultValue, helper, className = "" }: { label: string; name: string; defaultValue?: string; helper?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-bold mb-2 text-[#333]">{label}</label>
      <input name={name} defaultValue={defaultValue} className="w-full rounded-xl border border-[#ddd] bg-white text-[#222] h-12 px-4 outline-none focus:border-[#e50914]" />
      {helper ? <div className="text-xs text-neutral-500 mt-2">{helper}</div> : null}
    </div>
  );
}

function Result({ title, value }: { title: string; value: string }) {
  return (
    <div className="vip-soft-panel p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="text-3xl font-black text-[#e50914] mt-1">{value}</div>
    </div>
  );
}
