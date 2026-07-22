import Link from "next/link";
import { ContentType, type Prisma } from "@prisma/client";
import { MagicJobPauseInfo } from "./MagicJobPauseInfo";
import { prisma } from "@/lib/prisma";
import { getSimilarityJobSnapshot } from "@/lib/similarity/similarity-job";
import { SimilarityRecalculateControls } from "../similarity/SimilarityRecalculateControls";
import { TrendControls } from "../trends/trend-controls";
import { getVibixCatalogDashboardData } from "@/lib/vibix-catalog/catalog-audit";
import { getLatestVibixCatalogMagicJob } from "@/lib/vibix-catalog/catalog-magic-sync";
import { VIBIX_CATEGORY_IDS } from "@/lib/vibix-catalog/vibix-taxonomy-ids";
import {
  buildVibixIndexAction,
  activateTrendsCatalogAction,
  buildVibixPlayableLinksIndexAction,
  checkNewVibixCatalogAction,
  cancelVibixCatalogMagicAction,
  diagnoseVibixManualImportAction,
  importFoundVibixCatalogAction,
  importMissingFromVibixAction,
  hideMoviesWithoutVibixPlayerAction,
  importVibixTitleManuallyAction,
  moveMoviesToAnimeAction,
  queueDirtySimilarityAction,
  recalculateCatalogKindsAction,
  restartVibixCatalogMagicAction,
  runTrendSyncCatalogAction,
  runVibixCatalogMagicOnceAction,
  refreshVibixCatalogAuditAction,
  refreshVibixReferencesAction,
  refreshVibixTotalsAction,
  startDailyCatalogPipelineAction,
  syncMovieArtworkBatchAction,
  startVibixCatalogMagicAction,
  startVibixCoverageRepairAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ result?: string; similarityQ?: string }> };

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

function compactDetails(details: unknown) {
  const text = JSON.stringify(details, null, 2);
  if (text.length <= 8_000) return text;
  return `${text.slice(0, 8_000)}

...обрезано для стабильности админки. Полные детали смотри в логах Render/worker.`;
}

const playableWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
    { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
  ],
};

async function getTrendDashboardData() {
  const [
    run,
    catalogRun,
    statuses,
    candidates,
    hero,
    qualityProblems,
    missingPoster,
    missingBackdrop,
    missingPlayer,
    totalMovies,
    publicVisibleCount,
    homeVisibleCount,
    heroVisibleCount,
    popularEligibleCount,
    topEligibleCount,
    freshEligibleCount,
    typeGroups,
  ] = await Promise.all([
    prisma.trendSyncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.catalogEngineRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.trendCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.trendCandidate.findMany({ orderBy: { sourceScore: "desc" }, take: 20 }),
    prisma.movie.findMany({ where: { isPublished: true, isCatalogAllowed: true, isHeroEligible: true }, orderBy: { homeScore: "desc" }, take: 8 }),
    prisma.movie.count({ where: { isPublished: true, isQualityDataComplete: false } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ posterUrl: null }, { posterUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ backdropUrl: null }, { backdropUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, AND: [
      { OR: [{ vibixIframeUrl: null }, { vibixIframeUrl: "" }] },
      { OR: [{ vibixEmbedCode: null }, { vibixEmbedCode: "" }] },
    ] } }),
    prisma.movie.count(),
    prisma.movie.count({ where: { isPublicVisible: true } }),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, isHomeEligible: true } }),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, isHeroEligible: true } }),
    prisma.movie.count({ where: { isPopularEligible: true } }),
    prisma.movie.count({ where: { isTopEligible: true } }),
    prisma.movie.count({ where: { isFreshEligible: true } }),
    prisma.movie.groupBy({ by: ["type"], where: { isPublished: true, isCatalogAllowed: true }, _count: { _all: true } }),
  ]);

  const statusCount = new Map(statuses.map((item) => [item.status, item._count._all]));
  const typeCount = new Map(typeGroups.map((item) => [item.type, item._count._all]));
  const playableVisible = await prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, ...playableWhere } });

  return {
    tmdbConfigured: Boolean(process.env.TMDB_API_KEY?.trim()),
    run,
    catalogRun,
    statusCount,
    typeCount,
    candidates,
    hero,
    qualityProblems,
    missingPoster,
    missingBackdrop,
    missingPlayer,
    totalMovies,
    publicVisibleCount,
    playableVisible,
    homeVisibleCount,
    heroVisibleCount,
    popularEligibleCount,
    topEligibleCount,
    freshEligibleCount,
  };
}

export default async function AdminCatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const actionResult = parseResult(params.result);
  const [data, magicJob, similaritySnapshot, trendData] = await Promise.all([getVibixCatalogDashboardData(), getLatestVibixCatalogMagicJob(), getSimilarityJobSnapshot(), getTrendDashboardData()]);
  const similarityQ = params.similarityQ?.trim() || "Мстители: Война бесконечности";
  const movieTotal = data.safeVibix.availableMovie || null;
  const serialTotal = data.safeVibix.availableSerial || null;
  const redfilmTotal = data.my.total;
  const vibixKnownTotal = data.safeVibix.availableTotal || null;
  const apiKnownTotal = data.safeVibix.apiKnownTotal || null;

  return (
    <div className="container admin-shell py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в админку</Link>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="break-words text-[clamp(1.75rem,6vw,2.5rem)] font-black text-[#222]">Операционный центр REDFILM</h1>
          <p className="mt-2 max-w-4xl text-neutral-600">Единая ежедневная панель: Vibix → импорт → похожие → тренды → витрина.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/catalog/vibix" className="rounded-xl bg-[#e50914] px-5 py-3 text-center font-bold text-white">Смотреть VIBIX</Link>
          <Link href="/admin/seo" className="rounded-xl bg-[#333] px-5 py-3 text-center font-bold text-white">SEO</Link>
        </div>
      </div>

      {actionResult ? (
        <div className={`mt-5 rounded-xl border px-4 py-3 ${actionResult.ok === false ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <div className="font-bold">{actionResult.message ?? "Готово"}</div>
          {actionResult.details ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-[#222]">{compactDetails(actionResult.details)}</pre> : null}
        </div>
      ) : null}


      <section className="admin-panel mt-5 overflow-hidden border-2 border-[#e50914] bg-gradient-to-br from-[#fff5f5] to-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Ежедневный порядок</h2>
            <p className="mt-2 max-w-4xl text-sm text-neutral-600">Нажимай сверху вниз вручную или запускай весь сценарий одной кнопкой. После первичной полной загрузки ежедневный сценарий проверяет только свежие первые страницы Vibix и сам останавливается после нескольких страниц без новых тайтлов.</p>
          </div>
          <form action={startDailyCatalogPipelineAction}>
            <button className="h-14 rounded-2xl bg-[#e50914] px-6 text-lg font-black text-white shadow-lg shadow-red-200">Запустить весь pipeline</button>
          </form>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <DailyStep step="1" title="Быстрая проверка Vibix" description="Проверить свежие первые страницы фильмов/сериалов, не проходя весь каталог. Стоп после страниц без новых." action={checkNewVibixCatalogAction} />
          <DailyStep step="2" title="Докачать найденное" description="Импортировать missing, обновить существующие карточки без плеера, починить watch/public." action={importFoundVibixCatalogAction} />
          <DailyStep step="3" title="Найти похожие" description="Поставить в очередь похожие для новых/dirty фильмов после импорта." action={queueDirtySimilarityAction} />
          <DailyStep step="4" title="Найти тренды" description="Запустить Vibix-first Trend Sync и проверить кандидатов в Vibix." action={runTrendSyncCatalogAction} />
          <DailyStep step="5" title="Включить тренды" description="Финально пересчитать каталог, главную, популярное, ТОП и новинки." action={activateTrendsCatalogAction} />
        </div>
      </section>

      <section className="admin-panel mt-5 overflow-hidden border-2 border-[#e50914] bg-gradient-to-br from-[#fff5f5] to-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Фоновая задача Vibix / Daily pipeline</h2>
            <p className="mt-2 max-w-4xl text-sm text-neutral-600">Здесь видно состояние активной фоновой задачи. Daily-режим проверяет свежие страницы сверху; полная загрузка нужна только аварийно/после большой пересборки.</p>
          </div>
          <form action={startVibixCatalogMagicAction}>
            <button className="h-14 rounded-2xl bg-[#e50914] px-6 text-lg font-black text-white shadow-lg shadow-red-200">⚠ Полная загрузка Vibix</button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Статус</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob?.status ?? "—"}</div></div>
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Этап</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob?.currentStage ?? "—"}</div></div>
          <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">Тип / page</div><div className="mt-1 text-xl font-black text-[#222]">{magicJob ? `${magicJob.currentType} / ${magicJob.nextPage}` : "—"}</div></div>
          <Stat label="Проиндексировано" value={magicJob?.indexed ?? null} />
          <Stat label="К догрузке найдено" value={magicJob?.missing ?? null} bad />
          <Stat label="Импортировано" value={(magicJob?.imported ?? 0) + (magicJob?.updated ?? 0) || null} good />
          <Stat label="Страниц без новых" value={magicJob?.noNewPages ?? null} />
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

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <form action={runVibixCatalogMagicOnceAction}><button className="h-12 w-full rounded-xl bg-[#333] px-4 font-bold text-white">Продолжить сейчас</button></form>
          <form action={startVibixCoverageRepairAction}><button className="h-12 w-full rounded-xl bg-[#e50914] px-4 font-bold text-white">Починить важные автоматически</button></form>
          <form action={cancelVibixCatalogMagicAction}><button className="h-12 w-full rounded-xl border border-red-200 bg-white px-4 font-bold text-[#e50914]">Остановить</button></form>
          <form action={restartVibixCatalogMagicAction}><button className="h-12 w-full rounded-xl border border-[#333] bg-white px-4 font-bold text-[#222]">Начать заново</button></form>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Чтобы оно реально работало без кликов, в Render нужен отдельный background worker со Start Command: <b>npm run vibix:catalog-worker</b>. Без worker кнопка только создаст задачу, а “Продолжить сейчас” снимет паузу и сделает один шаг вручную.
        </div>
      </section>


      <section className="admin-panel mt-5 border-2 border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Точечный импорт по Vibix embed</h2>
            <p className="mt-2 max-w-4xl text-sm text-sky-950">
              Вставь код из Vibix/Rendex, нажми импорт — REDFILM вытащит <b>data-type</b> и <b>data-id</b>, попробует получить детали из Vibix и добавит/обновит тайтл.
            </p>
          </div>
          <Link href="/admin/catalog/vibix" className="rounded-xl bg-[#e50914] px-5 py-3 text-center font-bold text-white">Смотреть VIBIX</Link>
        </div>
        <form className="mt-4 grid gap-3 lg:grid-cols-6" action={importVibixTitleManuallyAction}>
          <label className="text-sm font-bold text-[#333] lg:col-span-6">
            Vibix embed code
            <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#ddd] bg-white px-4 py-3 font-mono text-sm text-[#222]" name="embedCode" defaultValue={'<ins data-publisher-id="678353780" data-type="series" data-id="7712"></ins>'} />
          </label>
          <Select label="Тип fallback" name="manualType" options={[["serial", "Авто/сериал"], ["movie", "Фильм"]]} />
          <Input label="Vibix ID fallback" name="vibixId" defaultValue="" min="1" max="10000000" />
          <TextInput label="KP ID fallback" name="kpId" />
          <TextInput label="IMDb ID fallback" name="imdbId" />
          <Input label="Год fallback" name="year" defaultValue="" min="1880" max="2200" />
          <TextInput label="Название fallback" name="title" />
          <button className="h-12 rounded-xl bg-[#e50914] px-5 font-bold text-white lg:col-span-3">Импортировать по embed</button>
          <button className="h-12 rounded-xl border border-[#333] bg-white px-5 font-bold text-[#222] lg:col-span-3" formAction={diagnoseVibixManualImportAction}>Только проверить</button>
        </form>
        <div className="mt-4 rounded-2xl border border-sky-200 bg-white p-4 text-sm text-sky-950">
          Если Vibix по <b>data-id</b> отдаёт полные данные — название, год, постер, жанры и плеер подтянутся автоматически. Если Vibix по ID не отдаст details, заполни fallback название/год вручную.
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
          <p className="mt-1 text-sm text-neutral-500">Главные цифры ниже считаются по REDFILM available /links index, а не по общему миллионному meta.total Vibix.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Vibix movie available" value={movieTotal} accent />
            <Stat label="Vibix serial available" value={serialTotal} accent />
            <Stat label="Vibix available всего" value={vibixKnownTotal || null} />
            <Stat label="Хвост к проверке" value={vibixKnownTotal ? Math.max(0, vibixKnownTotal - redfilmTotal) : null} bad={Boolean(vibixKnownTotal && vibixKnownTotal > redfilmTotal)} />
            <Stat label="categories" value={data.referenceCounts.categories ?? 0} />
            <Stat label="genres" value={data.referenceCounts.genres ?? 0} />
            <Stat label="countries" value={data.referenceCounts.countries ?? 0} />
            <Stat label="tags" value={data.referenceCounts.tags ?? 0} />
            <Stat label="voiceovers" value={data.referenceCounts.voiceovers ?? 0} />
          </div>
          {data.safeVibix.suspiciousApiTotals ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Общий Vibix API meta.total сейчас показывает {apiKnownTotal?.toLocaleString("ru-RU") ?? "много"} записей. Это полный технический каталог Vibix, не available-каталог REDFILM; worker больше не использует эту цифру для полной загрузки.
            </div>
          ) : null}
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
          <Stat label="/links available" value={data.index.playable} good />
          <Stat label="Уже есть" value={data.index.present} good />
          <Stat label="Не дошло до Movie" value={data.index.missing} bad />
          <Stat label="Сырой get_kpids" value={data.index.rawOnly} />
          <Stat label="Detail 404" value={data.index.detailMissing} bad />
          <Stat label="Импортировано индексом" value={data.index.imported} good />
          <Stat label="Auto-repair" value={data.index.autoRepaired} good />
          <Stat label="Проверено exact" value={data.index.verifiedOk} />
          <Stat label="Low-value skip" value={data.index.lowValueSkipped} />
          <Stat label="Ошибок импорта" value={data.index.failed} bad />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <form action={hideMoviesWithoutVibixPlayerAction} className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <h3 className="text-lg font-black text-[#222]">Почистить карточки без плеера</h3>
            <p className="mt-1 text-xs text-red-900">Не удаляет из базы, а скрывает с сайта всё, где нет iframe_url/embed_code или vibixAvailable=false.</p>
            <button className="mt-3 h-12 w-full rounded-xl bg-[#e50914] px-4 font-bold text-white">Скрыть мусор без плеера</button>
          </form>
          <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-900">
            Покрытие теперь проверяй по связке: <b>/links available</b> → <b>Не дошло до Movie</b> → <b>Импортировано индексом</b>. Если “Не дошло до Movie” больше нуля после импорта — жми “Докачать найденное”.
          </div>
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
              <Select label="exist_kp_id" name="existKpId" options={[ ["true", "true — available слой с KP ID"], ["", "Не отправлять"], ["false", "false — без фильтра KP"] ]} />
              <Select label="no_ads" name="noAds" options={[ ["", "Не отправлять"], ["true", "true"], ["false", "false"] ]} />
              <Select label="lgbt" name="lgbt" options={[ ["", "Не отправлять"], ["true", "true"], ["false", "false"] ]} />
              <Input label="Начать со страницы /links" name="startPage" defaultValue="1" min="1" max="100000" />
              <Input label="Страниц за запуск" name="pages" defaultValue="50" min="1" max="100" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#333]"><input name="useFields" type="checkbox" /> Отправлять fields[]: id, name, kp_id, imdb_id, iframe_url, poster_url, genre, country, tags</label>
            <p className="mt-2 text-xs text-green-900">Для REDFILM full rebuild держи exist_kp_id=true и limit=50. Без этого Vibix отдаёт общий миллионный каталог, который нам не нужен.</p>
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
          <div className="mt-1">Ежедневный сценарий: 1) проверить новые Vibix → 2) докачать найденное → 3) найти похожие → 4) найти тренды → 5) включить тренды. Сырой get_kpids оставлен только для контроля.</div>
        </div>
      </section>

      <section className="admin-panel mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Перераспределение категорий</h2>
            <p className="mt-1 text-sm text-neutral-500">Если аниме случайно попало в “Фильмы”, нажми перенос: кнопка найдёт MOVIE-записи с Vibix category 18 / жанром anime / японской анимацией и переведёт их в раздел “Аниме”.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={moveMoviesToAnimeAction}><button className="h-12 rounded-xl bg-[#e50914] px-5 font-bold text-white">Перенести аниме из фильмов</button></form>
            <form action={recalculateCatalogKindsAction}><button className="h-12 rounded-xl bg-[#333] px-5 font-bold text-white">Пересчитать каталог и типы</button></form>
          </div>
        </div>
      </section>

      <section id="similarity" className="admin-panel mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Похожие фильмы</h2>
            <p className="mt-1 text-sm text-neutral-500">После любого импорта новые/обновлённые фильмы должны уходить в dirty-очередь. Обычный ежедневный режим — пересчитать только новые/dirty, полный пересчёт нужен редко.</p>
          </div>
          <a href={`/api/admin/similarity/debug?q=${encodeURIComponent(similarityQ)}&limit=30`} target="_blank" className="rounded-xl bg-[#333] px-5 py-3 text-center font-bold text-white">Debug JSON</a>
        </div>
        <SimilarityRecalculateControls initialSnapshot={similaritySnapshot} />
        <form className="mt-5 flex flex-col gap-3 md:flex-row" action="/admin/catalog#similarity">
          <input name="similarityQ" defaultValue={similarityQ} className="min-h-11 flex-1 rounded-lg border border-[#ddd] bg-white px-3 text-[#222]" />
          <button className="rounded-lg bg-[#333] px-5 py-3 font-bold text-white" type="submit">Поставить пример</button>
          <a className="rounded-lg bg-[#e50914] px-5 py-3 font-bold text-white" href={`/api/admin/similarity/debug?q=${encodeURIComponent(similarityQ)}&limit=30`} target="_blank">Открыть debug JSON</a>
        </form>
      </section>

      <section id="trends" className="admin-panel mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#222]">Тренды и витрина</h2>
            <p className="mt-1 text-sm text-neutral-500">Trend Engine теперь живёт здесь: диагностика главной, Quality Gate, кандидаты и финальное включение витрины.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/trends/home-preview" className="rounded-xl border border-[#ddd] bg-white px-4 py-3 text-sm font-bold text-[#222]">Home JSON</a>
            <a href="/api/admin/trends/hero-preview" className="rounded-xl border border-[#ddd] bg-white px-4 py-3 text-sm font-bold text-[#222]">Hero JSON</a>
          </div>
        </div>
        {!trendData.tmdbConfigured ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900">TMDB_API_KEY не указан. Это нормально: базовая витрина работает в Vibix-first режиме.</div> : null}
        <form action={syncMovieArtworkBatchAction} className="mt-4 rounded-2xl border border-[#ddd] bg-white p-4">
          <h3 className="text-lg font-black text-[#222]">Movie Artwork: задники, постеры, логотипы</h3>
          <p className="mt-1 text-sm text-neutral-600">Идемпотентно проходит каталог: сначала фильмы без artwork/backdrop, затем устаревшие и приоритетные. Cursor из результата можно передать в следующий запуск.</p>
          {!trendData.tmdbConfigured ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">TMDB_API_KEY не указан. Кнопка вернёт disabled state, сайт продолжит использовать сохранённые backdropUrl.</div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input label="Фильмов за запуск" name="limit" defaultValue="25" min="1" max="100" />
            <Input label="Concurrency" name="concurrency" defaultValue="2" min="1" max="4" />
            <TextInput label="Cursor (необязательно)" name="cursor" defaultValue="" />
            <button className="h-12 self-end rounded-xl bg-[#e50914] px-5 font-bold text-white">Докачать artwork</button>
          </div>
        </form>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Всего Movie" value={trendData.totalMovies} />
          <Stat label="Public visible" value={trendData.publicVisibleCount} good={trendData.publicVisibleCount > 0} />
          <Stat label="С плеером для главной" value={trendData.playableVisible} good={trendData.playableVisible > 0} />
          <Stat label="Home visible" value={trendData.homeVisibleCount} good={trendData.homeVisibleCount > 0} />
          <Stat label="Hero visible" value={trendData.heroVisibleCount} good={trendData.heroVisibleCount > 0} />
          <Stat label="Проблемы качества" value={trendData.qualityProblems} />
          <Stat label="Без poster" value={trendData.missingPoster} bad={trendData.missingPoster > 0} />
          <Stat label="Без backdrop" value={trendData.missingBackdrop} />
          <Stat label="Без player" value={trendData.missingPlayer} bad={trendData.missingPlayer > 0} />
          <Stat label="Popular eligible" value={trendData.popularEligibleCount} good={trendData.popularEligibleCount > 0} />
          <Stat label="Top eligible" value={trendData.topEligibleCount} good={trendData.topEligibleCount > 0} />
          <Stat label="Fresh eligible" value={trendData.freshEligibleCount} good={trendData.freshEligibleCount > 0} />
          <Stat label="Фильмы" value={trendData.typeCount.get(ContentType.MOVIE) ?? 0} />
          <Stat label="Сериалы" value={trendData.typeCount.get(ContentType.SERIES) ?? 0} />
          <Stat label="Аниме" value={trendData.typeCount.get(ContentType.ANIME) ?? 0} />
          <Stat label="AVAILABLE" value={trendData.statusCount.get("AVAILABLE") ?? 0} />
          <Stat label="NOT_IN_VIBIX" value={trendData.statusCount.get("NOT_IN_VIBIX") ?? 0} />
          <Stat label="NEEDS_ENRICHMENT" value={trendData.statusCount.get("NEEDS_ENRICHMENT") ?? 0} />
          <Stat label="FAILED" value={trendData.statusCount.get("FAILED") ?? 0} bad={(trendData.statusCount.get("FAILED") ?? 0) > 0} />
        </div>
        <div className="mt-5">
          <TrendControls />
        </div>
        {(trendData.run?.message || trendData.catalogRun?.message) ? <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-[#222]"><h3 className="mb-2 text-lg font-black">Последние сообщения</h3>{trendData.run?.message ? <pre className="mb-2 whitespace-pre-wrap rounded-lg bg-[#f5f5f5] p-3 text-xs">Trend: {trendData.run.message}</pre> : null}{trendData.catalogRun?.message ? <pre className="whitespace-pre-wrap rounded-lg bg-[#f5f5f5] p-3 text-xs">Catalog: {trendData.catalogRun.message}</pre> : null}</div> : null}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#eee] bg-white p-4">
            <h3 className="mb-3 text-lg font-black text-[#222]">Hero preview</h3>
            <div className="grid gap-2">
              {trendData.hero.length ? trendData.hero.map((movie) => <Link key={movie.id} href={`/watch/${movie.slug}`} className="rounded-lg border border-[#ddd] p-3"><b>{movie.titleRu}</b><span className="ml-2 text-neutral-500">{movie.homeScore.toFixed(1)}</span></Link>) : <div className="rounded-lg border border-[#ddd] p-3 text-neutral-500">Hero пока пустой. Нажми “Включить тренды”.</div>}
            </div>
          </div>
          <div className="rounded-2xl border border-[#eee] bg-white p-4">
            <h3 className="mb-3 text-lg font-black text-[#222]">Лучшие кандидаты</h3>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-sm text-[#222]"><thead className="text-neutral-500"><tr><th className="p-2">Название</th><th className="p-2">Источник</th><th className="p-2">Год</th><th className="p-2">Score</th><th className="p-2">Статус</th></tr></thead><tbody>{trendData.candidates.map((item) => <tr key={item.id} className="border-t border-[#eee]"><td className="p-2 font-medium">{item.titleRu || item.titleOriginal}</td><td className="p-2">{item.sourceCategory}</td><td className="p-2">{item.year || "—"}</td><td className="p-2">{item.sourceScore.toFixed(1)}</td><td className="p-2">{item.status}</td></tr>)}</tbody></table>
            </div>
          </div>
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

function DailyStep({ step, title, description, action }: { step: string; title: string; description: string; action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="flex h-full flex-col rounded-2xl border border-[#eee] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e50914] text-lg font-black text-white">{step}</div>
        <h3 className="text-base font-black text-[#111]">{title}</h3>
      </div>
      <p className="min-h-16 flex-1 text-sm leading-5 text-neutral-600">{description}</p>
      <button className="mt-4 h-11 rounded-xl bg-[#333] px-4 font-bold text-white">Запустить</button>
    </form>
  );
}

function Stat({ label, value, accent, good, bad }: { label: string; value?: number | null; accent?: boolean; good?: boolean; bad?: boolean }) {
  const color = accent ? "text-[#e50914]" : good ? "text-green-700" : bad ? "text-red-700" : "text-[#222]";
  return <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3"><div className="text-xs text-neutral-500">{label}</div><div className={`mt-1 text-2xl font-black ${color}`}>{format(value)}</div></div>;
}

function Input({ label, name, defaultValue, min, max }: { label: string; name: string; defaultValue: string; min: string; max: string }) {
  return <label className="text-sm font-bold text-[#333]">{label}<input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name={name} type="number" defaultValue={defaultValue} min={min} max={max} /></label>;
}


function TextInput({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="text-sm font-bold text-[#333]">{label}<input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name={name} type="text" defaultValue={defaultValue ?? ""} /></label>;
}

function Select({ label, name, options }: { label: string; name: string; options: [string, string][] }) {
  return <label className="text-sm font-bold text-[#333]">{label}<select className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name={name}>{options.map(([value, text]) => <option key={value || "all"} value={value}>{text}</option>)}</select></label>;
}
