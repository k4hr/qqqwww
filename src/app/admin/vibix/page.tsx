import Link from "next/link";
import { syncVibixAllAction, syncVibixQuickAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    imported?: string;
    updated?: string;
    skipped?: string;
    errors?: string;
    pagesProcessed?: string;
    totalFromVibix?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing_key: "VIBIX_API_KEY не настроен в переменных окружения.",
  already_running: "Синхронизация Vibix уже выполняется. Дождитесь её завершения.",
  sync_failed: "Синхронизация завершилась с системной ошибкой. Проверьте server logs.",
};

export default async function VibixAdminPage({ searchParams }: Props) {
  const result = await searchParams;
  const configured = Boolean(process.env.VIBIX_API_KEY?.trim());
  const hasResult = [result.imported, result.updated, result.skipped, result.errors, result.pagesProcessed, result.totalFromVibix].some(Boolean);
  const errorMessage = result.error ? errorMessages[result.error] || "Не удалось запустить синхронизацию." : null;

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

      {hasResult ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Result label="Страниц обработано" value={result.pagesProcessed} />
          <Result label="Всего записей Vibix" value={result.totalFromVibix} />
          <Result label="Импортировано" value={result.imported} />
          <Result label="Обновлено" value={result.updated} />
          <Result label="Пропущено" value={result.skipped} />
          <Result label="Ошибок" value={result.errors} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={syncVibixQuickAction} className="admin-panel grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-xl font-bold text-[#222]">Быстрая синхронизация</h2>
            <p className="mt-1 text-sm text-neutral-500">Ограниченный запуск для проверки настроек.</p>
          </div>
          <label className="text-sm font-bold text-[#333]">
            Страниц
            <input name="pages" type="number" min="1" max="1000" defaultValue="5" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]" />
          </label>
          <label className="text-sm font-bold text-[#333]">
            Видео на страницу
            <input name="limit" type="number" min="1" max="200" defaultValue="100" className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222] outline-none focus:border-[#e50914]" />
          </label>
          <button type="submit" disabled={!configured} className="h-12 rounded-xl bg-[#333] font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400 sm:col-span-2">Быстрая синхронизация</button>
        </form>

        <form action={syncVibixAllAction} className="admin-panel flex flex-col p-5">
          <h2 className="text-xl font-bold text-[#222]">Полная база Vibix</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">Автоматически пройдёт все страницы из meta.last_page. Если meta отсутствует, остановится на первой пустой странице.</p>
          <div className="mt-4 rounded-xl bg-[#f5f5f5] p-4 text-sm text-neutral-600">Limit: 100 · Safety limit: 10 000 страниц</div>
          <button type="submit" disabled={!configured} className="mt-auto h-12 rounded-xl bg-[#e50914] font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400">Синхронизировать всю базу Vibix</button>
        </form>
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value?: string }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{label}</div><div className="mt-1 text-3xl font-black text-[#e50914]">{value || "0"}</div></div>;
}
