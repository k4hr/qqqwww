import Link from "next/link";
import { syncVibixAllAction, syncVibixQuickAction } from "./actions";
import type { VibixSkippedReason, VibixSkippedSample } from "@/lib/vibix-sync";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    imported?: string;
    updated?: string;
    skipped?: string;
    errors?: string;
    pagesProcessed?: string;
    totalFromVibix?: string;
    rateLimited?: string;
    message?: string;
    enrichedByKp?: string;
    enrichedByImdb?: string;
    enrichmentFailed?: string;
    missingIframeAfterEnrichment?: string;
    skippedReasons?: string;
    skippedSamples?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing_key: "VIBIX_API_KEY не настроен в переменных окружения.",
  already_running: "Синхронизация Vibix уже выполняется. Дождитесь её завершения.",
  sync_failed: "Синхронизация завершилась с системной ошибкой. Проверьте server logs.",
};

const skippedReasonLabels: Record<VibixSkippedReason, string> = {
  missing_iframe_url: "Нет iframe_url",
  missing_title: "Нет названия",
  missing_identifier: "Нет KP / IMDb / Vibix ID",
  unknown_type: "Неизвестный тип",
  invalid_response: "Некорректная запись ответа",
  other: "Другая причина",
};

export default async function VibixAdminPage({ searchParams }: Props) {
  const result = await searchParams;
  const configured = Boolean(process.env.VIBIX_API_KEY?.trim());
  const hasResult = [result.imported, result.updated, result.skipped, result.errors, result.pagesProcessed, result.totalFromVibix].some(Boolean);
  const errorMessage = result.error ? errorMessages[result.error] || "Не удалось запустить синхронизацию." : null;
  const rateLimited = result.rateLimited === "1";
  const skippedReasons = parseSkippedReasons(result.skippedReasons);
  const skippedSamples = parseSkippedSamples(result.skippedSamples);

  return (
    <div className="container admin-shell py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в админку</Link>
      <h1 className="mt-3 text-3xl font-bold text-[#222]">Синхронизация Vibix</h1>
      <p className="mt-2 max-w-3xl text-neutral-600">Импортирует реальные карточки и ссылки на плеер Vibix по Kinopoisk или IMDb ID.</p>

      <div className="admin-panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-[#333]">VIBIX_API_KEY</div>
            <div className={configured ? "mt-1 text-sm font-bold text-green-700" : "mt-1 text-sm font-bold text-red-700"}>
              {configured ? "Настроен" : "Не настроен"}
            </div>
          </div>
          <div className="text-sm text-neutral-500">Publisher ID: {process.env.VIBIX_PUBLISHER_ID?.trim() || "678353780"}</div>
        </div>
      </div>

      {errorMessage ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700">{errorMessage}</div> : null}
      {rateLimited ? <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-bold text-amber-800">Vibix временно ограничил запросы. Попробуйте позже или уменьшите количество страниц.</div> : null}
      {!rateLimited && result.message ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700">{result.message}</div> : null}

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Если Vibix вернул 429, подождите и запустите позже. Для полной базы лучше синхронизировать частями.
      </div>

      {hasResult ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Result label="Страниц обработано" value={result.pagesProcessed} />
          <Result label="Всего записей Vibix" value={result.totalFromVibix} />
          <Result label="Импортировано" value={result.imported} />
          <Result label="Обновлено" value={result.updated} />
          <Result label="Пропущено" value={result.skipped} />
          <Result label="Ошибок" value={result.errors} />
          <Result label="Дополнено через KP" value={result.enrichedByKp} />
          <Result label="Дополнено через IMDb" value={result.enrichedByImdb} />
          <Result label="Enrichment не удался" value={result.enrichmentFailed} />
          <Result label="Нет iframe после enrichment" value={result.missingIframeAfterEnrichment} />
        </div>
      ) : null}

      {hasResult ? (
        <div className="admin-panel mt-5 p-5">
          <h2 className="text-xl font-bold text-[#222]">Диагностика пропусков</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(skippedReasonLabels) as VibixSkippedReason[]).map((reason) => (
              <div key={reason} className="rounded-xl bg-[#f5f5f5] px-4 py-3 text-sm text-[#333]">
                <span className="font-bold">{skippedReasonLabels[reason]}:</span> {skippedReasons[reason] || 0}
              </div>
            ))}
          </div>
          {skippedSamples.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs text-[#333]">
                <thead className="border-b border-[#ddd] text-neutral-500"><tr><th className="p-2">Причина</th><th className="p-2">ID</th><th className="p-2">Название</th><th className="p-2">kp_id</th><th className="p-2">kinopoisk_id</th><th className="p-2">imdb_id</th><th className="p-2">iframe из links</th><th className="p-2">iframe после enrichment</th></tr></thead>
                <tbody>{skippedSamples.map((sample, index) => (
                  <tr key={`${sample.id ?? "unknown"}-${index}`} className="border-b border-[#eee] align-top">
                    <td className="p-2 font-bold">{sample.reason}</td>
                    <td className="p-2">{String(sample.id ?? "—")}</td>
                    <td className="p-2">{sample.name_rus || sample.name || "—"}</td>
                    <td className="p-2">{String(sample.kp_id ?? "—")}</td>
                    <td className="p-2">{String(sample.kinopoisk_id ?? "—")}</td>
                    <td className="p-2">{String(sample.imdb_id ?? "—")}</td>
                    <td className="max-w-[260px] break-all p-2 text-neutral-500">{sample.iframeUrlFromLinks || "—"}</td>
                    <td className="max-w-[260px] break-all p-2 text-neutral-500">{sample.iframeUrlAfterEnrichment || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={syncVibixQuickAction} className="admin-panel grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-xl font-bold text-[#222]">Быстрая синхронизация</h2>
            <p className="mt-1 text-sm text-neutral-500">Безопасный тест: начните с одной страницы по 10–20 записей.</p>
          </div>
          <label className="text-sm font-bold text-[#333]">
            Тип каталога
            <select name="type" defaultValue="movie" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]">
              <option value="movie">Фильмы</option>
              <option value="serial">Сериалы</option>
            </select>
          </label>
          <label className="text-sm font-bold text-[#333]">
            Страниц
            <input name="pages" type="number" min="1" max="20" defaultValue="1" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]" />
          </label>
          <label className="text-sm font-bold text-[#333]">
            Видео на страницу
            <input name="limit" type="number" min="1" max="100" defaultValue="10" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]" />
          </label>
          <div className="flex flex-wrap gap-5 text-sm text-[#333] sm:col-span-2">
            <label className="flex items-center gap-2"><input name="noAds" type="checkbox" /> Отправить no_ads=true</label>
            <label className="flex items-center gap-2"><input name="lgbt" type="checkbox" /> Отправить lgbt=true</label>
          </div>
          <label className="text-sm font-bold text-[#333] sm:col-span-2">
            Задержка между страницами, мс
            <input name="pageDelayMs" type="number" min="250" max="60000" step="250" defaultValue="2000" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]" />
          </label>
          <button type="submit" disabled={!configured} className="h-12 rounded-xl bg-[#333] font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400 sm:col-span-2">Быстрая синхронизация</button>
        </form>

        <form action={syncVibixAllAction} className="admin-panel flex flex-col p-5">
          <h2 className="text-xl font-bold text-[#222]">Полная база Vibix</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">Автоматически пройдёт все страницы из meta.last_page. Если meta отсутствует, остановится на первой пустой странице.</p>
          <div className="mt-4 rounded-xl bg-[#f5f5f5] p-4 text-sm text-neutral-600">Фильмы + сериалы · Limit: 50 · Задержка страниц: 2 000 мс · Задержка detail-запросов: 750 мс · До 20 страниц за запуск</div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm text-[#333]">
            <label className="flex items-center gap-2"><input name="noAds" type="checkbox" /> Отправить no_ads=true</label>
            <label className="flex items-center gap-2"><input name="lgbt" type="checkbox" /> Отправить lgbt=true</label>
          </div>
          <button type="submit" disabled={!configured} className="mt-auto h-12 rounded-xl bg-[#e50914] font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400">Синхронизировать всю базу Vibix</button>
        </form>
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value?: string }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{label}</div><div className="mt-1 text-3xl font-black text-[#e50914]">{value || "0"}</div></div>;
}

function parseSkippedReasons(value?: string) {
  try {
    return value ? JSON.parse(value) as Partial<Record<VibixSkippedReason, number>> : {};
  } catch {
    return {};
  }
}

function parseSkippedSamples(value?: string) {
  try {
    const parsed = value ? JSON.parse(value) as unknown : [];
    return Array.isArray(parsed) ? parsed.slice(0, 3) as VibixSkippedSample[] : [];
  } catch {
    return [];
  }
}
