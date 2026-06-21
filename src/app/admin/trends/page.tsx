import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TrendControls } from "./trend-controls";

export const dynamic = "force-dynamic";

export default async function AdminTrendsPage() {
  const tmdbConfigured = Boolean(process.env.TMDB_API_KEY?.trim());
  const [run, statuses, candidates, hero, qualityProblems, missingPoster, missingBackdrop, missingPlayer, blocked, titleRows, candidateTotal, homeCount, heroCount, trendingCount] = await Promise.all([
    prisma.trendSyncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.trendCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.trendCandidate.findMany({ orderBy: { sourceScore: "desc" }, take: 40 }),
    prisma.movie.findMany({ where: { isHeroEligible: true }, orderBy: { homeScore: "desc" }, take: 10 }),
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
    prisma.movie.count({ where: { isHomeEligible: true } }),
    prisma.movie.count({ where: { isHeroEligible: true } }),
    prisma.movie.count({ where: { isTrendingEligible: true } }),
  ]);
  const englishTitles = titleRows.filter((movie) => !/[а-яё]/iu.test(movie.titleRu)).length;
  const statusCount = new Map(statuses.map((item) => [item.status, item._count._all]));
  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex items-center justify-between"><div><h1 className="text-3xl font-bold">Trend Engine</h1><p className="mt-1 text-neutral-600">Автоматические кандидаты TMDB, Smart Import Vibix и Quality Gate.</p></div><Link href="/admin" className="font-bold text-[#e50914]">Назад</Link></div>
    {!tmdbConfigured ? <div className="admin-panel mb-5 border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900">TMDB_API_KEY не указан, внешние TMDB-тренды отключены. Vibix-first режим доступен.</div> : null}
    <section className="admin-panel mb-5 p-5"><TrendControls /></section>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat title="Последний запуск" value={run?.status ?? "нет"} />
      <Stat title="Найдено" value={run?.candidatesFound ?? 0} />
      <Stat title="Импортировано" value={run?.imported ?? 0} />
      <Stat title="Проблемы качества" value={qualityProblems} />
      <Stat title="Без poster" value={missingPoster} />
      <Stat title="Без backdrop" value={missingBackdrop} />
      <Stat title="Без player" value={missingPlayer} />
      <Stat title="Английский titleRu" value={englishTitles} />
      <Stat title="Не прошли Quality Gate" value={blocked} />
      <Stat title="Кандидатов всего" value={candidateTotal} />
      <Stat title="Home eligible" value={homeCount} />
      <Stat title="Hero eligible" value={heroCount} />
      <Stat title="Trending eligible" value={trendingCount} />
      <Stat title="AVAILABLE" value={statusCount.get("AVAILABLE") ?? 0} />
      <Stat title="NOT_IN_VIBIX" value={statusCount.get("NOT_IN_VIBIX") ?? 0} />
      <Stat title="NEEDS_ENRICHMENT" value={statusCount.get("NEEDS_ENRICHMENT") ?? 0} />
      <Stat title="FAILED" value={statusCount.get("FAILED") ?? 0} />
    </div>
    <section className="admin-panel mb-5 p-5"><h2 className="mb-3 text-xl font-bold">Диагностика</h2><div className="flex flex-wrap gap-2"><a href="/api/admin/trends/candidates?status=NOT_IN_VIBIX" className="rounded-lg border border-[#ddd] px-3 py-2">Без Vibix</a><a href="/api/admin/trends/candidates?status=NEEDS_ENRICHMENT" className="rounded-lg border border-[#ddd] px-3 py-2">Нужно обогащение</a><a href="/api/admin/trends/hero-preview" className="rounded-lg border border-[#ddd] px-3 py-2">Hero JSON</a><a href="/api/admin/trends/quality-problems?kind=poster" className="rounded-lg border border-[#ddd] px-3 py-2">Без poster</a><a href="/api/admin/trends/quality-problems?kind=backdrop" className="rounded-lg border border-[#ddd] px-3 py-2">Без backdrop</a><a href="/api/admin/trends/quality-problems?kind=english" className="rounded-lg border border-[#ddd] px-3 py-2">Английские названия</a><a href="/api/admin/trends/quality-problems?kind=blocked" className="rounded-lg border border-[#ddd] px-3 py-2">Quality blocked</a><a href="/api/admin/trends/quality-problems?kind=breakdown" className="rounded-lg border border-[#ddd] px-3 py-2">Block reasons</a></div></section>
    <section className="admin-panel mb-5 p-5"><h2 className="mb-3 text-xl font-bold">Статусы кандидатов</h2><div className="flex flex-wrap gap-2">{statuses.map((item) => <span key={item.status} className="rounded-full bg-[#f2f2f2] px-3 py-2 text-sm">{item.status}: {item._count._all}</span>)}</div></section>
    <section className="admin-panel mb-5 p-5"><h2 className="mb-3 text-xl font-bold">Hero preview</h2><div className="grid gap-2 sm:grid-cols-2">{hero.map((movie) => <Link key={movie.id} href={`/watch/${movie.slug}`} className="rounded-lg border border-[#ddd] p-3"><b>{movie.titleRu}</b><span className="ml-2 text-neutral-500">{movie.homeScore.toFixed(1)}</span></Link>)}</div></section>
    <section className="admin-panel p-5"><h2 className="mb-3 text-xl font-bold">Лучшие кандидаты</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-500"><th className="p-2">Название</th><th>Источник</th><th>Год</th><th>Score</th><th>Статус</th></tr></thead><tbody>{candidates.map((item) => <tr key={item.id} className="border-t border-[#eee]"><td className="p-2 font-medium">{item.titleRu || item.titleOriginal}</td><td>{item.sourceCategory}</td><td>{item.year || "—"}</td><td>{item.sourceScore.toFixed(1)}</td><td>{item.status}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className="mt-2 text-2xl font-bold text-[#e50914]">{value}</div></div>;
}
