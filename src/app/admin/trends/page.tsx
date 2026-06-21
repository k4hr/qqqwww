import Link from "next/link";
import { ContentType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TrendControls } from "./trend-controls";

export const dynamic = "force-dynamic";

const playableWhere: Prisma.MovieWhereInput = {
  OR: [
    { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
    { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
  ],
};

export default async function AdminTrendsPage() {
  const tmdbConfigured = Boolean(process.env.TMDB_API_KEY?.trim());
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
    blocked,
    titleRows,
    candidateTotal,
    totalMovies,
    publishedCatalog,
    playableVisible,
    homeCount,
    heroCount,
    trendingCount,
    publicVisibleCount,
    popularEligibleCount,
    topEligibleCount,
    freshEligibleCount,
    homeVisibleCount,
    heroVisibleCount,
    typeGroups,
  ] = await Promise.all([
    prisma.trendSyncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.catalogEngineRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.trendCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.trendCandidate.findMany({ orderBy: { sourceScore: "desc" }, take: 40 }),
    prisma.movie.findMany({ where: { isPublished: true, isCatalogAllowed: true, isHeroEligible: true }, orderBy: { homeScore: "desc" }, take: 10 }),
    prisma.movie.count({ where: { isPublished: true, isQualityDataComplete: false } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ posterUrl: null }, { posterUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, OR: [{ backdropUrl: null }, { backdropUrl: "" }] } }),
    prisma.movie.count({ where: { isPublished: true, AND: [
      { OR: [{ vibixIframeUrl: null }, { vibixIframeUrl: "" }] },
      { OR: [{ vibixEmbedCode: null }, { vibixEmbedCode: "" }] },
    ] } }),
    prisma.movie.count({ where: { isPublished: true, isHomeEligible: false } }),
    prisma.movie.findMany({ where: { isPublished: true }, select: { titleRu: true } }),
    prisma.trendCandidate.count(),
    prisma.movie.count(),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true } }),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, ...playableWhere } }),
    prisma.movie.count({ where: { isHomeEligible: true } }),
    prisma.movie.count({ where: { isHeroEligible: true } }),
    prisma.movie.count({ where: { isTrendingEligible: true } }),
    prisma.movie.count({ where: { isPublicVisible: true } }),
    prisma.movie.count({ where: { isPopularEligible: true } }),
    prisma.movie.count({ where: { isTopEligible: true } }),
    prisma.movie.count({ where: { isFreshEligible: true } }),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, isHomeEligible: true } }),
    prisma.movie.count({ where: { isPublished: true, isCatalogAllowed: true, isHeroEligible: true } }),
    prisma.movie.groupBy({ by: ["type"], where: { isPublished: true, isCatalogAllowed: true }, _count: { _all: true } }),
  ]);
  const englishTitles = titleRows.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).length;
  const statusCount = new Map(statuses.map((item) => [item.status, item._count._all]));
  const typeCount = new Map(typeGroups.map((item) => [item.type, item._count._all]));

  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Trend Engine</h1>
        <p className="mt-1 text-neutral-600">Catalog Engine, Vibix Update Watcher, Smart Import, Quality Gate и диагностика выдачи.</p>
      </div>
      <Link href="/admin" className="font-bold text-[#e50914]">Назад</Link>
    </div>

    {!tmdbConfigured ? <div className="admin-panel mb-5 border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900">TMDB_API_KEY не указан, внешние TMDB-тренды отключены. Это нормально: базовая витрина работает в Vibix-first режиме.</div> : null}

    <section className="admin-panel mb-5 p-5">
      <h2 className="mb-3 text-xl font-black">Что нажимать и зачем</h2>
      <TrendControls />
    </section>

    <section className="admin-panel mb-5 p-5">
      <h2 className="mb-3 text-xl font-black">Главная реально видит</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Опубликовано в каталоге" value={publishedCatalog} good={publishedCatalog > 0} />
        <Stat title="С плеером для главной" value={playableVisible} good={playableVisible > 0} />
        <Stat title="Home visible" value={homeVisibleCount} good={homeVisibleCount > 0} />
        <Stat title="Hero visible" value={heroVisibleCount} good={heroVisibleCount > 0} />
      </div>
      <p className="mt-3 text-sm text-neutral-600">Если Home visible/Hero visible больше нуля, но главная пустая — это кэш или запрос главной. Открой <a className="font-bold text-[#e50914]" href="/api/admin/trends/home-preview">home-preview JSON</a>.</p>
    </section>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat title="Последний запуск" value={run?.status ?? "нет"} good={run?.status === "COMPLETED"} />
      <Stat title="Найдено за запуск" value={run?.candidatesFound ?? 0} />
      <Stat title="Импорт/обновлено" value={run?.imported ?? 0} />
      <Stat title="Всего Movie" value={totalMovies} good={totalMovies > 0} />
      <Stat title="Проблемы качества" value={qualityProblems} />
      <Stat title="Без poster" value={missingPoster} />
      <Stat title="Без backdrop" value={missingBackdrop} />
      <Stat title="Без player" value={missingPlayer} good={missingPlayer < 500} />
      <Stat title="Английский titleRu" value={englishTitles} />
      <Stat title="Не прошли Quality Gate" value={blocked} />
      <Stat title="Кандидатов всего" value={candidateTotal} />
      <Stat title="Home eligible total" value={homeCount} good={homeCount > 0} />
      <Stat title="Hero eligible total" value={heroCount} good={heroCount > 0} />
      <Stat title="Trending eligible" value={trendingCount} />
      <Stat title="Public visible" value={publicVisibleCount} good={publicVisibleCount > 0} />
      <Stat title="Popular eligible" value={popularEligibleCount} good={popularEligibleCount > 0} />
      <Stat title="Top eligible" value={topEligibleCount} good={topEligibleCount > 0} />
      <Stat title="Fresh eligible" value={freshEligibleCount} good={freshEligibleCount > 0} />
      <Stat title="Фильмы" value={typeCount.get(ContentType.MOVIE) ?? 0} good={(typeCount.get(ContentType.MOVIE) ?? 0) > 0} />
      <Stat title="Сериалы" value={typeCount.get(ContentType.SERIES) ?? 0} good={(typeCount.get(ContentType.SERIES) ?? 0) > 0} />
      <Stat title="Мультфильмы" value={typeCount.get(ContentType.CARTOON) ?? 0} good={(typeCount.get(ContentType.CARTOON) ?? 0) > 0} />
      <Stat title="Аниме" value={typeCount.get(ContentType.ANIME) ?? 0} />
      <Stat title="AVAILABLE" value={statusCount.get("AVAILABLE") ?? 0} />
      <Stat title="NOT_IN_VIBIX" value={statusCount.get("NOT_IN_VIBIX") ?? 0} />
      <Stat title="NEEDS_ENRICHMENT" value={statusCount.get("NEEDS_ENRICHMENT") ?? 0} />
      <Stat title="FAILED" value={statusCount.get("FAILED") ?? 0} />
    </div>

    {run?.message || catalogRun?.message ? <section className="admin-panel mb-5 p-4"><h2 className="mb-2 text-lg font-black">Последние сообщения</h2>{run?.message ? <pre className="mb-2 whitespace-pre-wrap rounded-lg bg-[#f5f5f5] p-3 text-xs">Trend: {run.message}</pre> : null}{catalogRun?.message ? <pre className="whitespace-pre-wrap rounded-lg bg-[#f5f5f5] p-3 text-xs">Catalog: {catalogRun.message}</pre> : null}</section> : null}

    <section className="admin-panel mb-5 p-5">
      <h2 className="mb-3 text-xl font-bold">Диагностика</h2>
      <div className="flex flex-wrap gap-2">
        <a href="/api/admin/trends/home-preview" className="rounded-lg border border-[#ddd] px-3 py-2">Что видит главная</a>
        <a href="/api/admin/trends/candidates?status=NOT_IN_VIBIX" className="rounded-lg border border-[#ddd] px-3 py-2">Без Vibix</a>
        <a href="/api/admin/trends/candidates?status=NEEDS_ENRICHMENT" className="rounded-lg border border-[#ddd] px-3 py-2">Нужно обогащение</a>
        <a href="/api/admin/trends/hero-preview" className="rounded-lg border border-[#ddd] px-3 py-2">Hero JSON</a>
        <a href="/api/admin/trends/quality-problems?kind=poster" className="rounded-lg border border-[#ddd] px-3 py-2">Без poster</a>
        <a href="/api/admin/trends/quality-problems?kind=backdrop" className="rounded-lg border border-[#ddd] px-3 py-2">Без backdrop</a>
        <a href="/api/admin/trends/quality-problems?kind=english" className="rounded-lg border border-[#ddd] px-3 py-2">Английские названия</a>
        <a href="/api/admin/trends/quality-problems?kind=blocked" className="rounded-lg border border-[#ddd] px-3 py-2">Quality blocked</a>
        <a href="/api/admin/trends/quality-problems?kind=breakdown" className="rounded-lg border border-[#ddd] px-3 py-2">Block reasons</a>
        <a href="/api/admin/trends/catalog-preview?target=popular" className="rounded-lg border border-[#ddd] px-3 py-2">/popular JSON</a>
        <a href="/api/admin/trends/catalog-preview?target=top" className="rounded-lg border border-[#ddd] px-3 py-2">/top-100 JSON</a>
        <a href="/api/admin/trends/catalog-preview?target=fresh" className="rounded-lg border border-[#ddd] px-3 py-2">Новинки JSON</a>
        <a href="/api/admin/trends/catalog-preview?target=popular&type=CARTOON" className="rounded-lg border border-[#ddd] px-3 py-2">Мультфильмы JSON</a>
        <a href="/api/admin/trends/catalog-preview?target=popular&type=ANIME" className="rounded-lg border border-[#ddd] px-3 py-2">Аниме JSON</a>
      </div>
    </section>

    <section className="admin-panel mb-5 p-5">
      <h2 className="mb-3 text-xl font-bold">Hero preview</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {hero.length ? hero.map((movie) => <Link key={movie.id} href={`/watch/${movie.slug}`} className="rounded-lg border border-[#ddd] p-3"><b>{movie.titleRu}</b><span className="ml-2 text-neutral-500">{movie.homeScore.toFixed(1)}</span></Link>) : <div className="rounded-lg border border-[#ddd] p-3 text-neutral-500">Hero пока пустой. Нажми шаг 1, затем шаг 2, потом снова шаг 1.</div>}
      </div>
    </section>

    <section className="admin-panel p-5">
      <h2 className="mb-3 text-xl font-bold">Лучшие кандидаты</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-500"><th className="p-2">Название</th><th>Источник</th><th>Год</th><th>Score</th><th>Статус</th></tr></thead><tbody>{candidates.map((item) => <tr key={item.id} className="border-t border-[#eee]"><td className="p-2 font-medium">{item.titleRu || item.titleOriginal}</td><td>{item.sourceCategory}</td><td>{item.year || "—"}</td><td>{item.sourceScore.toFixed(1)}</td><td>{item.status}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function Stat({ title, value, good }: { title: string; value: string | number; good?: boolean }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className={`mt-2 text-2xl font-bold ${good ? "text-emerald-600" : "text-[#e50914]"}`}>{value}</div></div>;
}
