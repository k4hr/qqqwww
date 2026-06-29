import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSeoAdminStats } from "@/lib/seo/keyword-engine";
import { getSeoOpportunityReport } from "@/lib/seo/opportunity-engine";
import { generateAiSeoPageAction, generateTopAiSeoPagesAction, importWordstatCsvAction, rebuildEmbeddedWordstatAction, runSeoAutopilotAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ result?: string }> };

function decodeResult(value?: string) {
  if (!value) return null;
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { return null; }
}

export default async function AdminSeoPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = decodeResult(params.result);
  const [stats, opportunities, clusters, pages, excluded] = await Promise.all([
    getSeoAdminStats(),
    getSeoOpportunityReport(180),
    prisma.seoCluster.findMany({ orderBy: [{ totalDemand: "desc" }, { updatedAt: "desc" }], take: 30 }).catch(() => []),
    prisma.seoLandingPage.findMany({ orderBy: [{ totalDemand: "desc" }, { updatedAt: "desc" }], take: 30 }).catch(() => []),
    prisma.seoKeyword.findMany({ where: { status: "EXCLUDED" }, orderBy: { impressions: "desc" }, take: 10 }).catch(() => []),
  ]);

  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold">SEO Keyword Engine</h1>
        <p className="mt-1 text-neutral-600">Wordstat → кластеры → SEO-посадочные страницы → sitemap и перелинковка.</p>
      </div>
      <Link href="/admin" className="font-bold text-[#e50914]">Назад</Link>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <Stat title="Ключей" value={stats.keywords} />
      <Stat title="Активных" value={stats.activeKeywords} />
      <Stat title="Исключено" value={stats.excludedKeywords} />
      <Stat title="На проверке" value={stats.reviewKeywords} />
      <Stat title="Кластеров" value={stats.clusters} />
      <Stat title="Страниц" value={stats.pages} />
      <Stat title="В sitemap" value={stats.indexablePages} />
    </div>

    {result ? <pre className="mb-5 overflow-auto rounded-xl bg-[#111] p-4 text-xs text-white">{JSON.stringify(result, null, 2)}</pre> : null}

    <section className="admin-panel mb-5 border-2 border-[#e50914]/30 p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-black">SEO Opportunity Engine</h2>
          <p className="mt-2 max-w-4xl text-sm text-neutral-600">Показывает не просто ключи, а покрытие спроса: какой запрос уже закрыт страницей REDFILM, где нет фильма, где нет Vibix-плеера, где не хватает похожих, сезонных страниц или подборок.</p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-4 xl:min-w-[560px]">
          <MiniStat title="Проверено" value={opportunities.checked} />
          <MiniStat title="Спрос" value={opportunities.totalDemand} />
          <MiniStat title="Покрыто" value={`${opportunities.readyShare}%`} />
          <MiniStat title="Не закрыто" value={opportunities.missingDemand} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-[#eee] bg-white p-4">
          <h3 className="font-black">По статусам</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">{opportunities.byStatus.map((item) => <span key={item.status} className="rounded-full bg-neutral-100 px-3 py-2"><b>{item.status}</b> · {item.count} · {item.demand.toLocaleString("ru-RU")}</span>)}</div>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-4">
          <h3 className="font-black">По интентам</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">{opportunities.byIntent.map((item) => <span key={item.intent} className="rounded-full bg-neutral-100 px-3 py-2"><b>{item.intent}</b> · {item.count} · {item.demand.toLocaleString("ru-RU")}</span>)}</div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#eee] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Запрос</th><th className="p-3">Спрос</th><th className="p-3">Интент</th><th className="p-3">Статус</th><th className="p-3">Цель</th><th className="p-3">Что делать</th></tr></thead>
          <tbody>
            {opportunities.opportunities.slice(0, 40).map((item) => <tr key={item.normalizedQuery} className="border-t border-[#eee] align-top">
              <td className="p-3 font-bold">{item.query}</td>
              <td className="p-3 whitespace-nowrap">{item.impressions.toLocaleString("ru-RU")}</td>
              <td className="p-3 text-xs text-neutral-500">{item.intent}</td>
              <td className="p-3"><span className={item.status === "READY" ? "rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700" : "rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-[#e50914]"}>{item.status}</span></td>
              <td className="p-3">{item.targetUrl ? <Link href={item.targetUrl} target="_blank" className="font-bold text-[#e50914]">{item.entityTitle || item.targetUrl}</Link> : <span className="text-neutral-400">—</span>}</td>
              <td className="p-3 max-w-md text-neutral-600">{item.problem}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section className="admin-panel mb-5 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black">Яндекс Переобход</h2>
          <p className="mt-2 text-sm text-neutral-600">Собрать 150 приоритетных публичных URL: /watch, /similar, коллекции, жанры, годы и страны.</p>
        </div>
        <Link href="/admin/seo/reindex" className="rounded-xl bg-[#e50914] px-5 py-3 text-center font-black text-white">Открыть список URL</Link>
      </div>
    </section>

    <section className="admin-panel mb-5 border-2 border-[#e50914]/30 p-5">
      <h2 className="text-xl font-black">SEO Autopilot</h2>
      <p className="mt-2 text-sm text-neutral-600">Одна кнопка: пересобирает встроенный Wordstat без дублей, чистит пустые и мусорные страницы, ставит redirect для широких запросов, прогоняет Quality Gate и запускает OpenAI для лучших страниц.</p>
      <form action={runSeoAutopilotAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm text-neutral-600">AI страниц за запуск</label>
        <input name="aiLimit" type="number" min={0} max={30} defaultValue={5} className="w-28 min-h-11 rounded-lg border border-[#ddd] bg-white px-3" />
        <button type="submit" className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white">Собрать SEO-страницы автоматически</button>
      </form>
      <p className="mt-2 text-xs text-neutral-500">Для первого запуска поставь 3–5 AI-страниц. Если OPENAI_API_KEY не задан, Autopilot всё равно очистит мусор, создаст кластеры и качественные indexable-страницы без AI-текста.</p>
    </section>

    <section className="admin-panel mb-5 p-5">
      <h2 className="text-xl font-black">AI SEO Builder</h2>
      <p className="mt-2 text-sm text-neutral-600">OpenAI API получает подготовленный контекст из базы REDFILM: запрос, тип страницы, реальные фильмы, жанры, рейтинги, актёров и ссылки. AI пишет текст и структуру, а backend валидирует результат и не даёт выдумывать фильмы.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <form action={generateAiSeoPageAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input name="slug" placeholder="Например: filmy-marvel-po-poryadku" className="min-h-11 rounded-lg border border-[#ddd] bg-white px-3" />
          <button type="submit" className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white">AI пересобрать страницу</button>
        </form>
        <form action={generateTopAiSeoPagesAction} className="flex gap-2">
          <input name="limit" type="number" min={1} max={30} defaultValue={10} className="w-24 min-h-11 rounded-lg border border-[#ddd] bg-white px-3" />
          <button type="submit" className="rounded-xl bg-[#222] px-5 py-3 font-black text-white">AI топ страниц</button>
        </form>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Нужны Railway Variables: OPENAI_API_KEY и, опционально, OPENAI_SEO_MODEL. Без ключа AI-кнопки покажут ошибку, обычный Wordstat Engine продолжит работать.</p>
    </section>

    <section className="admin-panel mb-5 p-5">
      <h2 className="text-xl font-black">Импорт Wordstat CSV</h2>
      <p className="mt-2 text-sm text-neutral-600">Загрузи CSV из Яндекс Вордстат или вставь содержимое. Система очистит мусор, сгруппирует запросы и создаст SeoLandingPage.</p>

      <form action={rebuildEmbeddedWordstatAction} className="mt-4">
        <button type="submit" className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white">Пересобрать встроенные CSV без дублей</button>
        <p className="mt-2 text-xs text-neutral-500">Использует файлы из src/data/wordstat, удаляет старый Wordstat-импорт и пересоздаёт ключи, кластеры и страницы.</p>
      </form>

      <form action={importWordstatCsvAction} className="mt-5 grid gap-3 border-t border-[#eee] pt-5">
        <input name="source" defaultValue="wordstat" className="min-h-11 rounded-lg border border-[#ddd] bg-white px-3" />
        <label className="flex items-center gap-2 text-sm text-neutral-700"><input name="replace" type="checkbox" /> Очистить старый Wordstat-импорт перед загрузкой</label>
        <input name="csvFile" type="file" accept=".csv,text/csv,text/plain" className="min-h-11 rounded-lg border border-[#ddd] bg-white px-3 py-2" />
        <textarea name="csvText" rows={8} placeholder="Можно вставить CSV сюда..." className="rounded-lg border border-[#ddd] bg-white p-3 font-mono text-sm" />
        <button type="submit" className="rounded-xl bg-[#333] px-5 py-3 font-black text-white">Импортировать загруженный CSV</button>
      </form>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="admin-panel p-5">
        <h2 className="text-xl font-black">Топ кластеров</h2>
        <div className="mt-3 space-y-2 text-sm">
          {clusters.map((item) => <div key={item.id} className="rounded-lg border border-[#eee] bg-white p-3"><b>{item.title}</b><br /><span className="text-neutral-500">{item.intent} · спрос {item.totalDemand.toLocaleString("ru-RU")} · /collections/{item.targetSlug}</span></div>)}
          {!clusters.length ? <div className="text-neutral-500">Кластеры ещё не созданы.</div> : null}
        </div>
      </section>

      <section className="admin-panel p-5">
        <h2 className="text-xl font-black">SEO-страницы</h2>
        <div className="mt-3 space-y-2 text-sm">
          {pages.map((item) => <div key={item.id} className="rounded-lg border border-[#eee] bg-white p-3"><Link href={seoPageHref(item.type, item.slug)} className="font-bold text-[#e50914]" target="_blank">{item.h1}</Link><br /><span className="text-neutral-500">{item.type} · статус {item.status} · AI {item.aiStatus} · min {item.minItems} · спрос {item.totalDemand.toLocaleString("ru-RU")}</span><form action={generateAiSeoPageAction} className="mt-2"><input type="hidden" name="slug" value={item.slug} /><button type="submit" className="rounded-lg border border-[#e50914] px-3 py-1 text-xs font-bold text-[#e50914]">AI пересобрать</button></form></div>)}
          {!pages.length ? <div className="text-neutral-500">SEO-страницы ещё не созданы.</div> : null}
        </div>
      </section>
    </div>

    <section className="admin-panel mt-5 p-5">
      <h2 className="text-xl font-black">Исключённые запросы</h2>
      <p className="mt-2 text-sm text-neutral-600">Adult/скачать/торрент и другой мусор не превращается в страницы и не попадает в sitemap.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {excluded.map((item) => <span key={item.id} className="rounded-full bg-neutral-100 px-3 py-2">{item.query} · {item.impressions}</span>)}
      </div>
    </section>
  </div>;
}

function seoPageHref(type: string, slug: string) {
  if (type === "SEASON_PAGE") return `/season/${slug}`;
  if (type === "SIMILAR_PAGE") return `/similar/${slug.replace(/^pohozhie-na-/, "")}`;
  if (type === "LIKE_PAGE") return `/like/${slug.replace(/^chto-posmotret-posle-/, "")}`;
  if (type === "PERSON_PAGE") return `/person/${slug.replace(/^filmy-s-/, "")}`;
  return `/collections/${slug}`;
}

function MiniStat({ title, value }: { title: string; value: string | number }) {
  return <div className="rounded-xl border border-[#eee] bg-white p-3"><div className="text-xs text-neutral-500">{title}</div><div className="mt-1 text-lg font-black text-[#e50914]">{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div></div>;
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className="mt-2 text-2xl font-bold text-[#e50914]">{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div></div>;
}
