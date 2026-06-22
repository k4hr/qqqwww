import Link from "next/link";
import { MagicJobPauseInfo } from "./MagicJobPauseInfo";
import { getVibixCatalogDashboardData } from "@/lib/vibix-catalog/catalog-audit";
import { getLatestVibixCatalogMagicJob } from "@/lib/vibix-catalog/catalog-magic-sync";
import { VIBIX_CATEGORY_IDS } from "@/lib/vibix-catalog/vibix-taxonomy-ids";
import {
  buildVibixIndexAction,
  buildVibixPlayableLinksIndexAction,
  cancelVibixCatalogMagicAction,
  importMissingFromVibixAction,
  recalculateCatalogKindsAction,
  restartVibixCatalogMagicAction,
  runVibixCatalogMagicOnceAction,
  refreshVibixCatalogAuditAction,
  refreshVibixReferencesAction,
  refreshVibixTotalsAction,
  startVibixCatalogMagicAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ result?: string }> };

type ActionResult = { ok?: boolean; message?: string; details?: unknown } | null;

function parseResult(value?: string): ActionResult {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ActionResult;
  } catch {
    return { ok: false, message: "Не удалось прочитать результат действия." };
  }
}

function format(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

function date(value?: Date | string | null) {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU");
}

export default async function AdminCatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const actionResult = parseResult(params.result);
  const [data, magicJob] = await Promise.all([getVibixCatalogDashboardData(), getLatestVibixCatalogMagicJob()]);
  const snapshotsByKey = new Map(data.snapshots.map((item) => [item.key, item]));
  const movieTotal = snapshotsByKey.get("movie_all")?.total ?? null;
  const serialTotal = snapshotsByKey.get("serial_all")?.total ?? null;
  const redfilmTotal = data.my.total;
  const vibixKnownTotal = (movieTotal ?? 0) + (serialTotal ?? 0);

  return (
    <div className="container admin-shell py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в админку</Link>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="break-words text-[clamp(1.75rem,6vw,2.5rem)] font-black text-[#222]">КАТАЛОГ</h1>
          <p className="mt-2 max-w-4xl text-neutral-600">Контроль покрытия базы: что есть у REDFILM, что есть у Vibix, чего не хватает и что нужно догрузить.</p>
        </div>
        <Link href="/admin/vibix" className="rounded-xl bg-[#333] px-5 py-3 text-center font-bold text-white">Vibix sync</Link>
      </div>

      {actionResult ? (
        <div className={`mt-5 rounded-xl border px-4 py-3 ${actionResult.ok === false ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <div className="font-bold">{actionResult.message ?? "Готово"}</div>
          {actionResult.details ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-[#222]">{JSON.stringify(actionResult.details, null, 2)}</pre> : null}
        </div>
      ) : null}


      <section className="admin-panel mt-5 overflow-hidden border-2 border-[#e50914] bg-gradient-to-br from-[#fff5f5] to-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">ВОЛШЕБНАЯ ЗАГРУЗКА ВСЕГО VIBIX</h2>
            <p className="mt-2 max-w-4xl text-sm text-neutral-600">Одна кнопка создаёт фоновую задачу: обновляет справочники Vibix, строит доступный /links индекс для фильмов и сериалов, при 429 сама уходит на паузу, потом продолжает, догружает недостающее и пересчитывает каталог.</p>
          </div>
          <form action={startVibixCatalogMagicAction}>
            <button className="h-14 rounded-2xl bg-[#e50914] px-6 text-lg font-black text-white shadow-lg shadow-red-200">Загрузить всё автоматически</button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Статус</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob?.status ?? "—"}</div></div>
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Этап</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob?.currentStage ?? "—"}</div></div>
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Тип / page</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob ? `${magicJob.currentType} / ${magicJob.nextPage}` : "—"}</div></div>
          <Stat label="Проиндексировано" value={magicJob?.indexed ?? null} />
          <Stat label="К догрузке найдено" value={magicJob?.missing ?? null} bad />
          <Stat label="Импортировано" value={(magicJob?.imported ?? 0) + (magicJob?.updated ?? 0) || null} good />
        </div>

        {magicJob ? (
          <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-[#222]">
            <div><b>Сообщение:</b> {magicJob.message ?? "—"}</div>
            <MagicJobPauseInfo
              status={magicJob.status}
              pauseUntil={magicJob.rateLimitUntil?.toISOString() ?? null}
              updatedAt={magicJob.updatedAt?.toISOString() ?? null}
            />
            <div className="mt-1"><b>Ошибки:</b> {magicJob.failed} {magicJob.lastError ? <span className="text-red-700">— {magicJob.lastError.slice(0, 260)}</span> : null}</div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <form action={runVibixCatalogMagicOnceAction}><button className="h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Продолжить сейчас</button></form>
          <form action={cancelVibixCatalogMagicAction}><button className="h-12 w-full rounded-xl border border-red-200 bg-white px-4 font-bold text-[#e50914]">Остановить</button></form>
          <form action={restartVibixCatalogMagicAction}><button className="h-12 w-full rounded-xl border border-[#333] bg-white px-4 font-bold text-[#222]">Начать заново</button></form>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Чтобы оно реально работало без кликов, в Railway нужен отдельный service/worker со Start Command: <b>npm run vibix:catalog-worker</b>. Без worker кнопка только создаст задачу, а “Продолжить сейчас” снимет паузу и сделает один шаг вручную.
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="admin-panel p-5">
          <h2 className="text-2xl font-black text-[#222]">МОЙ КАТАЛОГ REDFILM</h2>
          <p className="mt-1 text-sm text-neutral-500">Реальные записи в PostgreSQL.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Всего" value={data.my.total} accent />
            <Stat label="Фильмы" value={data.my.movies} />
            <Stat label="Сериалы" value={data.my.series} />
            <Stat label="Мультфильмы" value={data.my.cartoons} />
            <Stat label="Аниме" value={data.my.anime} />
            <Stat label="Vibix available" value={data.my.vibixAvailable} />
            <Stat label="С плеером" value={data.my.withPlayer} good />
            <Stat label="Без плеера" value={data.my.withoutPlayer} bad />
            <Stat label="Без poster" value={data.my.withoutPoster} bad />
            <Stat label="С KP ID" value={data.my.withKp} />
            <Stat label="Без KP ID" value={data.my.withoutKp} />
            <Stat label="С IMDb ID" value={data.my.withImdb} />
            <Stat label="Видно на сайте" value={data.my.publicVisible} good />
            <Stat label="Популярное" value={data.my.popularEligible} />
            <Stat label="ТОП" value={data.my.topEligible} />
            <Stat label="Главная" value={data.my.homeEligible} />
          </div>
        </div>

        <div className="admin-panel p-5">
          <h2 className="text-2xl font-black text-[#222]">КАТАЛОГ VIBIX</h2>
          <p className="mt-1 text-sm text-neutral-500">Данные из Vibix API через meta.total и справочники.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Vibix movie" value={movieTotal} accent />
            <Stat label="Vibix serial" value={serialTotal} accent />
            <Stat label="Vibix всего известно" value={vibixKnownTotal || null} />
            <Stat label="Разница Vibix − REDFILM" value={vibixKnownTotal ? Math.max(0, vibixKnownTotal - redfilmTotal) : null} bad={Boolean(vibixKnownTotal && vibixKnownTotal > redfilmTotal)} />
            <Stat label="categories" value={data.referenceCounts.categories ?? 0} />
            <Stat label="genres" value={data.referenceCounts.genres ?? 0} />
            <Stat label="countries" value={data.referenceCounts.countries ?? 0} />
            <Stat label="tags" value={data.referenceCounts.tags ?? 0} />
            <Stat label="voiceovers" value={data.referenceCounts.voiceovers ?? 0} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <form action={refreshVibixCatalogAuditAction}><button className="h-12 w-full rounded-xl bg-[#e50914] px-4 font-bold text-white">Обновить всё Vibix</button></form>
            <form action={refreshVibixTotalsAction}><button className="h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Обновить totals</button></form>
            <form action={refreshVibixReferencesAction}><button className="h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Обновить справочники</button></form>
          </div>
        </div>
      </section>

      <section className="admin-panel mt-5 p-5">
        <h2 className="text-2xl font-black text-[#222]">Сравнение и недостающие</h2>
        <p className="mt-1 text-sm text-neutral-500">/links индекс — реальный доступный каталог для догрузки. /get_kpids — сырой контрольный список kpId, он может содержать ID без доступного detail.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="В индексе всего" value={data.index.total} />
          <Stat label="/links доступных" value={data.index.playable} good />
          <Stat label="Уже есть" value={data.index.present} good />
          <Stat label="К догрузке из /links" value={data.index.missing} bad />
          <Stat label="Сырой get_kpids" value={data.index.rawOnly} />
          <Stat label="Detail 404" value={data.index.detailMissing} bad />
          <Stat label="Импортировано индексом" value={data.index.imported} good />
          <Stat label="Ошибок импорта" value={data.index.failed} bad />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <form action={buildVibixPlayableLinksIndexAction} className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <h3 className="text-lg font-black text-[#222]">Построить доступный /links индекс</h3>
            <p className="mt-1 text-xs text-green-900">Это главный индекс для догрузки. Он берёт только реальные записи из /links, которые Vibix показывает как доступные.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select label="Тип" name="sourceType" options={[ ["movie", "Фильмы"], ["serial", "Сериалы"] ]} />
              <Select label="Категория" name="categoryId" options={[ ["", "Все"], [String(VIBIX_CATEGORY_IDS.anime), "Аниме"], [String(VIBIX_CATEGORY_IDS.cartoon), "Мультфильм"], [String(VIBIX_CATEGORY_IDS.adultCartoon), "Мультфильм для взрослых"], [String(VIBIX_CATEGORY_IDS.dorama), "Дорама"] ]} />
              <Select label="Доп. фильтр Vibix" name="filterKind" options={[ ["", "Нет"], ["category", "category[]"], ["genre", "genre[]"], ["tag", "tag[]"], ["country", "country[]"], ["voiceover", "voiceover[]"] ]} />
              <Input label="ID доп. фильтра" name="filterId" defaultValue="" min="1" max="100000" />
              <Input label="Год year[]" name="year" defaultValue="" min="1880" max="2200" />
              <Select label="exist_kp_id" name="existKpId" options={[ ["", "Не отправлять"], ["true", "true — только с KP ID"], ["false", "false — без фильтра KP"] ]} />
              <Select label="no_ads" name="noAds" options={[ ["", "Не отправлять"], ["true", "true"], ["false", "false"] ]} />
              <Select label="lgbt" name="lgbt" options={[ ["", "Не отправлять"], ["true", "true"], ["false", "false"] ]} />
              <Input label="Начать со страницы /links" name="startPage" defaultValue="1" min="1" max="100000" />
              <Input label="Страниц за запуск" name="pages" defaultValue="50" min="1" max="100" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#333]"><input name="useFields" type="checkbox" /> Отправлять fields[]: id, name, kp_id, imdb_id, iframe_url, poster_url, genre, country, tags</label>
            <p className="mt-2 text-xs text-green-900">Для полного каталога оставь exist_kp_id/no_ads/lgbt в режиме “Не отправлять”. Эти флаги нужны только для точечной диагностики, иначе можно случайно обрезать выдачу.</p>
            <button className="mt-4 h-12 w-full rounded-xl bg-[#e50914] px-4 font-bold text-white">Построить /links индекс</button>
          </form>

          <form action={buildVibixIndexAction} className="rounded-2xl border border-[#ddd] bg-white p-4">
            <h3 className="text-lg font-black text-[#222]">Сырой get_kpids индекс</h3>
            <p className="mt-1 text-xs text-neutral-500">Только для контроля. Vibix может отдавать здесь kpId, по которым /kp потом возвращает 404.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select label="Тип" name="sourceType" options={[ ["movie", "Фильмы"], ["serial", "Сериалы"] ]} />
              <Select label="Категория" name="categoryId" options={[ ["", "Все"], [String(VIBIX_CATEGORY_IDS.anime), "Аниме"], [String(VIBIX_CATEGORY_IDS.cartoon), "Мультфильм"], [String(VIBIX_CATEGORY_IDS.adultCartoon), "Мультфильм для взрослых"], [String(VIBIX_CATEGORY_IDS.dorama), "Дорама"] ]} />
              <Input label="Начать со страницы" name="startPage" defaultValue="1" min="1" max="100000" />
              <Input label="Страниц за запуск" name="pages" defaultValue="5" min="1" max="50" />
              <Input label="Limit get_kpids" name="limit" defaultValue="1000" min="100" max="1000" />
            </div>
            <button className="mt-4 h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Построить сырой индекс</button>
          </form>

          <form action={importMissingFromVibixAction} className="rounded-2xl border border-[#ddd] bg-white p-4">
            <h3 className="text-lg font-black text-[#222]">Догрузить недостающее из индекса</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select label="Тип" name="sourceType" options={[ ["both", "Фильмы + сериалы"], ["movie", "Фильмы"], ["serial", "Сериалы"] ]} />
              <Select label="Категория" name="categoryId" options={[ ["", "Все"], [String(VIBIX_CATEGORY_IDS.anime), "Аниме"], [String(VIBIX_CATEGORY_IDS.cartoon), "Мультфильм"], [String(VIBIX_CATEGORY_IDS.dorama), "Дорама"] ]} />
              <Input label="Сколько за запуск" name="limit" defaultValue="50" min="1" max="200" />
            </div>
            <button className="mt-4 h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Догрузить недостающее</button>
          </form>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold">Как пользоваться:</div>
          <div className="mt-1">1) Обновить всё Vibix → 2) Строить именно доступный /links индекс для movie/serial → 3) Догружать недостающее → 4) Пересчитать категории. Сырой get_kpids не использовать для догрузки.</div>
        </div>
      </section>

      <section className="admin-panel mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Перераспределение категорий</h2>
            <p className="mt-1 text-sm text-neutral-500">Использует точные Vibix ID: category 18 anime, 14 cartoon, genre 25 anime, 3 animation.</p>
          </div>
          <form action={recalculateCatalogKindsAction}><button className="h-12 rounded-xl bg-[#e50914] px-5 font-bold text-white">Пересчитать каталог и типы</button></form>
        </div>
      </section>

      <section className="admin-panel mt-5 p-5">
        <h2 className="text-2xl font-black text-[#222]">Vibix snapshots</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm text-[#222]">
            <thead className="border-b border-[#ddd] text-neutral-500"><tr><th className="p-2">Блок</th><th className="p-2">type</th><th className="p-2">filter</th><th className="p-2">total</th><th className="p-2">last_page</th><th className="p-2">checked</th><th className="p-2">error</th></tr></thead>
            <tbody className="divide-y divide-[#eee]">
              {data.snapshots.map((item) => (
                <tr key={item.id}>
                  <td className="p-2 font-bold">{item.label}</td>
                  <td className="p-2">{item.sourceType ?? "—"}</td>
                  <td className="p-2">{item.filterKind ? `${item.filterKind}:${item.filterId}` : "—"}</td>
                  <td className="p-2 font-bold text-[#e50914]">{format(item.total)}</td>
                  <td className="p-2">{format(item.lastPage)}</td>
                  <td className="p-2 text-xs text-neutral-500">{date(item.lastCheckedAt)}</td>
                  <td className="max-w-[320px] break-words p-2 text-xs text-red-700">{item.lastError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel mt-5 p-5">
        <h2 className="text-2xl font-black text-[#222]">Пример недостающих из индекса</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-[#222]">
            <thead className="border-b border-[#ddd] text-neutral-500"><tr><th className="p-2">type</th><th className="p-2">ID индекса / kpId</th><th className="p-2">Название</th><th className="p-2">Категория</th><th className="p-2">Источник</th><th className="p-2">Статус</th><th className="p-2">page</th><th className="p-2">Ошибка</th></tr></thead>
            <tbody className="divide-y divide-[#eee]">
              {data.index.missingPreview.map((item) => (
                <tr key={item.id}>
                  <td className="p-2">{item.sourceType}</td>
                  <td className="p-2 font-bold">{item.kpId}</td>
                  <td className="p-2">{item.title ?? "—"}</td>
                  <td className="p-2">{item.categoryName ?? item.categoryId ?? "—"}</td>
                  <td className="p-2">{item.indexSource}</td>
                  <td className="p-2">{item.importStatus}</td>
                  <td className="p-2">{item.sourcePage ?? "—"}</td>
                  <td className="max-w-[420px] break-words p-2 text-xs text-red-700">{item.lastImportError ?? "—"}</td>
                </tr>
              ))}
              {!data.index.missingPreview.length ? <tr><td className="p-3 text-neutral-500" colSpan={8}>Пока нет индекса или недостающих записей.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent, good, bad }: { label: string; value?: number | null; accent?: boolean; good?: boolean; bad?: boolean }) {
  const color = accent ? "text-[#e50914]" : good ? "text-green-700" : bad ? "text-red-700" : "text-[#222]";
  return <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">{label}</div><div className={`mt-1 text-2xl font-black ${color}`}>{format(value)}</div></div>;
}

function Input({ label, name, defaultValue, min, max }: { label: string; name: string; defaultValue: string; min: string; max: string }) {
  return <label className="text-sm font-bold text-[#333]">{label}<input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name={name} type="number" defaultValue={defaultValue} min={min} max={max} /></label>;
}

function Select({ label, name, options }: { label: string; name: string; options: [string, string][] }) {
  return <label className="text-sm font-bold text-[#333]">{label}<select className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name={name}>{options.map(([value, text]) => <option key={value || "all"} value={value}>{text}</option>)}</select></label>;
}
