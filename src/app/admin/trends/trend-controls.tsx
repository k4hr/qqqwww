"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TrendAction = {
  step: string;
  label: string;
  url: string;
  method: "POST";
  body?: Record<string, unknown>;
  title: string;
  description: string;
  when: string;
  primary?: boolean;
};

const actions: TrendAction[] = [
  {
    step: "1",
    label: "Полный пересчёт каталога",
    title: "Полный пересчёт каталога",
    description: "Заменяет команду npm run catalog:recalculate: заново раскладывает базу по Фильмам, Сериалам, Мультфильмам и Аниме, пересчитывает catalog/popular/top/fresh/home/hero/trending scores и все eligibility flags.",
    when: "Нажимать после деплоя, после импорта Vibix, после обогащения базы и после правок категорий. Это главная безопасная кнопка для обновления всей витрины.",
    url: "/api/admin/catalog/recalculate",
    method: "POST",
    primary: true,
  },
  {
    step: "2",
    label: "Обогатить старую базу Vibix",
    title: "Докачать embed_code и голоса",
    description: "Берёт уже существующие фильмы с KP/IMDb ID и докачивает detail через Vibix /kp или /imdb: embed_code, kp_votes, imdb_votes, персоны, постеры и backdrop.",
    when: "Нажимать, если в диагностике у Интерстеллара/Джентльменов/Зелёной мили есть missing_player или missing_votes, хотя они есть в Vibix.",
    url: "/api/admin/trends/enrich-existing",
    method: "POST",
    body: { batchSize: 50 },
  },
  {
    step: "3",
    label: "Проверить новые обновления Vibix",
    title: "Автообновление новых фильмов и сериалов",
    description: "Проверяет свежие страницы Vibix /links, импортирует новые и обновлённые тайтлы, докачивает detail, пересчитывает scores и раскладывает по страницам.",
    when: "Нажимать вручную после деплоя или когда нужно быстро подтянуть свежие обновления. Для автоматики запустить отдельный Railway worker: npm run vibix:update-worker.",
    url: "/api/admin/trends/vibix-update",
    method: "POST",
    body: { pagesPerRun: 5, limit: 50, detailLimit: 100 },
  },
  {
    step: "4",
    label: "Запустить Vibix-first Trend Sync",
    title: "Найти новые сильные фильмы из Vibix",
    description: "Без TMDB работает через Vibix: get_kpids/links → detail /kp → импорт/обновление → пересчёт. С TMDB дополнительно подтянет внешние тренды.",
    when: "Нажимать периодически для поиска новых популярных фильмов/сериалов. Не надо жать бесконечно, если Vibix дал 429.",
    url: "/api/admin/trends/run",
    method: "POST",
    body: { batchSize: 50 },
  },
  {
    step: "5",
    label: "Проверить кандидатов в Vibix",
    title: "Проверить TrendCandidate",
    description: "Проверяет уже найденных внешних кандидатов через Vibix по KP/IMDb/названию. Если кандидатов 0 — ничего страшного, значит сначала нужен Trend Sync.",
    when: "Нажимать после Trend Sync или когда в блоке кандидатов появились PENDING/NEEDS_ENRICHMENT.",
    url: "/api/admin/trends/check-vibix",
    method: "POST",
    body: { batchSize: 50 },
  },
];

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function TrendControls() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const orderedActions = useMemo(() => actions, []);

  async function run(action: TrendAction) {
    setPending(action.url);
    setMessage(`Запущено: ${action.title}`);
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body ?? {}),
      });
      const data = await response.json();
      setMessage(response.ok ? formatJson(data) : data.error || "Ошибка запуска");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setPending(null);
    }
  }

  return <div className="space-y-5">
    <div className="rounded-2xl border border-[#f2c94c] bg-[#fff8df] p-4 text-sm leading-6 text-[#4b3b00]">
      <b>Дополнительные инструменты Trend Engine:</b> основной ежедневный порядок теперь находится сверху на странице <code>/admin/catalog</code>. Эти кнопки нужны для ручной диагностики: пересчёт каталога, обогащение старой базы, свежие обновления Vibix, Vibix-first Trend Sync и проверка кандидатов.
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      {orderedActions.map((action) => <article key={action.url} className={`rounded-2xl border p-4 ${action.primary ? "border-[#e50914]/40 bg-[#fff1f2]" : "border-[#ddd] bg-white"}`}>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e50914] text-lg font-black text-white">{action.step}</div>
          <div>
            <h3 className="text-lg font-black text-[#111]">{action.title}</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-600">{action.description}</p>
          </div>
        </div>
        <div className="mb-4 rounded-xl bg-[#f6f6f6] p-3 text-xs leading-5 text-neutral-700"><b>Когда нажимать:</b> {action.when}</div>
        <button type="button" disabled={Boolean(pending)} onClick={() => run(action)} className="rounded-lg bg-[#e50914] px-4 py-3 font-bold text-white disabled:opacity-50">
          {pending === action.url ? "Выполняется…" : action.label}
        </button>
      </article>)}
    </div>

    <div className="flex flex-wrap gap-2">
      <a href="/api/admin/trends/home-preview" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">Проверить, что видит главная</a>
      <a href="/api/admin/trends/quality-problems?kind=breakdown" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">Причины блокировки JSON</a>
      <a href="/api/admin/trends/catalog-preview?target=popular" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">Диагностика /popular</a>
      <a href="/api/admin/trends/catalog-preview?target=top" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">Диагностика /top-100</a>
      <a href="/api/admin/trends/catalog-preview?target=popular&type=movie" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">/films</a>
      <a href="/api/admin/trends/catalog-preview?target=popular&type=series" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">/series</a>
      <a href="/api/admin/trends/catalog-preview?target=popular&type=cartoons" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">/cartoons</a>
      <a href="/api/admin/trends/catalog-preview?target=popular&type=anime" className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">/anime</a>
      <button type="button" onClick={() => router.refresh()} className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-bold">Обновить страницу</button>
    </div>

    {message ? <pre className="max-h-72 overflow-auto rounded-lg bg-[#f5f5f5] p-3 text-xs text-[#222] whitespace-pre-wrap">{message}</pre> : null}
  </div>;
}
