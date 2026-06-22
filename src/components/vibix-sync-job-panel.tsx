"use client";

import { useEffect, useMemo, useState } from "react";

export type VibixJobView = {
  id: string;
  status: string;
  contentType: string;
  currentType: string;
  nextPage: number;
  lastPage: number | null;
  total: number | null;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  playerByIframe: number;
  playerByEmbed: number;
  rateLimited: boolean;
  rateLimitUntil: string | null;
  lastError: string | null;
  lastFailedType: string | null;
  lastFailedPage: number | null;
  lastFailedAt: string | null;
  lastSkippedType: string | null;
  lastSkippedPage: number | null;
  skippedPagesJson: string | null;
  safeResumeNote: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type VibixResumeEstimateView = {
  limit: number;
  movieCount: number;
  serialCount: number;
  moviePage: number;
  serialPage: number;
  recommendedType: "movie" | "serial";
  recommendedPage: number;
  note: string;
};

type Props = { initialJob: VibixJobView | null; configured: boolean; resumeEstimate: VibixResumeEstimateView };
const API_BASE = "/api/admin/vibix/full-sync";

function parseSkippedPages(value: string | null) {
  if (!value) return [] as { type: string; page: number; at: string; error: string | null }[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const type = typeof record.type === "string" ? record.type : null;
      const page = Number(record.page);
      const at = typeof record.at === "string" ? record.at : "";
      const error = typeof record.error === "string" ? record.error : null;
      if (!type || !Number.isSafeInteger(page)) return [];
      return [{ type, page, at, error }];
    });
  } catch {
    return [];
  }
}

function parsePositivePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function VibixSyncJobPanel({ initialJob, configured, resumeEstimate }: Props) {
  const [job, setJob] = useState(initialJob);
  const [contentType, setContentType] = useState("both");
  const [manualType, setManualType] = useState<"movie" | "serial">(resumeEstimate.recommendedType);
  const [manualPage, setManualPage] = useState(String(resumeEstimate.recommendedPage));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const skippedPages = useMemo(() => parseSkippedPages(job?.skippedPagesJson ?? null), [job?.skippedPagesJson]);
  const hasUnfinishedJob = Boolean(job && !["DONE", "CANCELED"].includes(job.status));
  const canStartNew = configured && !busy && !hasUnfinishedJob;

  const refresh = async () => {
    try {
      const response = await fetch(`${API_BASE}/status`, { cache: "no-store" });
      if (response.ok) setJob((await response.json() as { job: VibixJobView | null }).job);
    } catch {
      // Keep the last known progress while the web service reconnects.
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const start = async (options: { resumeFromExisting?: boolean; startType?: "movie" | "serial"; startPage?: number; forceRestart?: boolean } = {}) => {
    if (hasUnfinishedJob) {
      setMessage("Уже есть незавершённая задача. Используй кнопки продолжения по базе или ручной страницы — они переставят текущую задачу, не создавая новую с page 1.");
      return;
    }
    if (!options.resumeFromExisting && !options.startPage) {
      const confirmed = window.confirm("Запустить НОВУЮ полную синхронизацию Vibix с page 1? Обычно это НЕ нужно, если база уже заполнена. Лучше нажать “Продолжить по текущей базе”.");
      if (!confirmed) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, ...options }),
      });
      const data = await response.json() as { job?: VibixJobView; message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось создать задачу");
      setJob(data.job ?? null);
      setMessage(data.message || "Задача запущена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать задачу");
    } finally {
      setBusy(false);
    }
  };

  const setStartPage = async (options: { resumeFromExisting?: boolean; startType?: "movie" | "serial"; startPage?: number }) => {
    if (!job) {
      await start(options);
      return;
    }
    if (["DONE", "CANCELED"].includes(job.status)) {
      await start(options);
      return;
    }
    const targetType = options.resumeFromExisting ? resumeEstimate.recommendedType : options.startType ?? manualType;
    const targetPage = options.resumeFromExisting ? resumeEstimate.recommendedPage : options.startPage ?? parsePositivePage(manualPage);
    const confirmed = window.confirm(`Переставить текущую задачу на ${targetType} page ${targetPage}? Это НЕ удаляет фильмы и не начинает с первой страницы.`);
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/set-start-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, contentType, ...options, startType: targetType, startPage: targetPage }),
      });
      const data = await response.json() as { job?: VibixJobView; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось переставить задачу");
      if (data.job) setJob(data.job);
      setMessage(`Задача переставлена на ${targetType} page ${targetPage}. Worker продолжит с этой точки.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переставить задачу");
    } finally {
      setBusy(false);
    }
  };

  const action = async (name: "pause" | "resume" | "cancel" | "skip-current") => {
    if (!job) return;
    if (name === "skip-current") {
      const confirmed = window.confirm(`Пропустить ${job.currentType} page ${job.nextPage} и продолжить со следующей страницы? Эту страницу можно будет повторить позже вручную.`);
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }) });
      const data = await response.json() as { job?: VibixJobView; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось изменить задачу");
      if (data.job) setJob(data.job);
      if (name === "skip-current") setMessage("Страница пропущена, задача поставлена в очередь на следующую страницу.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить задачу");
    } finally {
      setBusy(false);
    }
  };

  const completedPages = Math.max(0, job ? job.nextPage - 1 : 0);
  const progress = job?.lastPage ? Math.min(100, Math.round(completedPages / job.lastPage * 100)) : null;

  return (
    <section className="admin-panel mt-5 p-5">
      <h2 className="text-xl font-bold text-[#222]">Полная фоновая синхронизация</h2>
      <p className="mt-1 text-sm text-neutral-500">Кнопка создаёт задачу в PostgreSQL. Отдельный worker продолжает её до конца и возобновляет после перезапуска.</p>
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Если база уже частично высосана, не стартуй с page 1. Используй “Продолжить по текущей базе” или ручно укажи страницу.
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-[#ddd] bg-white p-4 lg:grid-cols-4">
        <Metric label="В базе movie-like" value={resumeEstimate.movieCount} />
        <Metric label="В базе serial-like" value={resumeEstimate.serialCount} />
        <Metric label="Рекомендуем movie page" value={resumeEstimate.moviePage} />
        <Metric label="Рекомендуем serial page" value={resumeEstimate.serialPage} />
        <div className="lg:col-span-4 rounded-lg bg-[#f5f5f5] px-4 py-3 text-sm text-[#333]">
          Расчёт идёт по текущей базе и limit={resumeEstimate.limit}. Если уже высосано около 16К записей по 20 на страницу, продолжение будет около page 800, а не page 1.
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select value={contentType} onChange={(event) => setContentType(event.target.value)} className="h-12 rounded-xl border border-[#ddd] bg-white px-4 text-[#222]">
          <option value="movie">Фильмы</option>
          <option value="serial">Сериалы</option>
          <option value="both">Фильмы + сериалы</option>
        </select>
        <button type="button" onClick={() => void setStartPage({ resumeFromExisting: true })} disabled={!configured || busy || (!job && !canStartNew)} className="min-h-12 break-words rounded-xl bg-[#e50914] px-5 font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400 max-sm:w-full">
          Продолжить по текущей базе
        </button>
      </div>

      <div className="mt-3 grid gap-3 rounded-xl border border-[#ddd] bg-[#fafafa] p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
        <select value={manualType} onChange={(event) => setManualType(event.target.value as "movie" | "serial")} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222]">
          <option value="movie">movie</option>
          <option value="serial">serial</option>
        </select>
        <input value={manualPage} onChange={(event) => setManualPage(event.target.value)} type="number" min="1" className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222]" placeholder="Страница, например 800" />
        <button type="button" onClick={() => void setStartPage({ startType: manualType, startPage: parsePositivePage(manualPage) })} disabled={!configured || busy || (!job && !canStartNew)} className="min-h-11 rounded-xl bg-[#333] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-400">
          Начать/переставить с этой страницы
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void start()} disabled={!canStartNew} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Опасно: начать с page 1</button>
      </div>

      {hasUnfinishedJob ? <div className="mt-3 rounded-lg bg-[#f5f5f5] px-4 py-3 text-sm font-bold text-[#333]">Есть незавершённая задача. Новую синхронизацию с page 1 нельзя случайно запустить. Можно переставить текущую задачу на рекомендованную страницу.</div> : null}
      {message ? <div className="mt-3 rounded-lg bg-[#f5f5f5] px-4 py-3 text-sm font-bold text-[#333]">{message}</div> : null}

      {job ? (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#222] px-3 py-1 text-xs font-bold text-white">{job.status}</span>
            <span className="text-sm text-neutral-500">Режим: {job.contentType} · сейчас: {job.currentType} · страница {job.nextPage}{job.lastPage ? ` / ${job.lastPage}` : ""}</span>
          </div>
          {job.lastFailedPage ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">Проблемная страница: <b>{job.lastFailedType} page {job.lastFailedPage}</b>. Нажми “Повторить эту страницу” или “Пропустить страницу и продолжить”.</div> : null}
          {job.safeResumeNote ? <div className="mb-4 rounded-xl bg-[#f5f5f5] px-4 py-3 text-sm text-[#333]">{job.safeResumeNote}</div> : null}
          {progress !== null ? <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#e5e5e5]"><div className="h-full bg-[#e50914] transition-all" style={{ width: `${progress}%` }} /></div> : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Всего" value={job.total} /><Metric label="Импортировано" value={job.imported} /><Metric label="Обновлено" value={job.updated} /><Metric label="Пропущено" value={job.skipped} />
            <Metric label="Ошибок" value={job.errors} /><Metric label="Плеер embed" value={job.playerByEmbed} /><Metric label="Плеер iframe" value={job.playerByIframe} /><Metric label="Последнее обновление" value={formatDate(job.updatedAt)} />
          </div>
          {job.lastError ? <pre className="mt-4 max-h-44 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-xl bg-red-50 p-4 text-xs text-red-800">{job.lastError}</pre> : null}
          <div className="mt-4 flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
            <button type="button" onClick={() => action("pause")} disabled={busy || !["QUEUED", "RUNNING"].includes(job.status)} className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-bold disabled:opacity-40">Пауза</button>
            <button type="button" onClick={() => action("resume")} disabled={busy || !["PAUSED", "FAILED"].includes(job.status)} className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-bold disabled:opacity-40">Повторить эту страницу</button>
            <button type="button" onClick={() => action("skip-current")} disabled={busy || !["PAUSED", "FAILED"].includes(job.status)} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-40">Пропустить страницу и продолжить</button>
            <button type="button" onClick={() => action("cancel")} disabled={busy || ["DONE", "CANCELED"].includes(job.status)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-40">Отменить</button>
            <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Обновить статус</button>
          </div>
          <div className="mt-3 text-xs text-neutral-500">Запущено: {formatDate(job.startedAt)} · Завершено: {formatDate(job.finishedAt)}{job.rateLimited ? ` · Пауза Vibix до ${formatDate(job.rateLimitUntil)}` : ""}</div>
          {skippedPages.length ? (
            <div className="mt-4 rounded-xl bg-[#f7f7f7] p-4">
              <div className="text-sm font-bold text-[#222]">Пропущенные страницы</div>
              <div className="mt-2 grid gap-1 text-xs text-neutral-600">
                {skippedPages.slice(-8).reverse().map((item) => <div key={`${item.type}-${item.page}-${item.at}`}>{item.type} page {item.page} · {formatDate(item.at)}</div>)}
              </div>
            </div>
          ) : null}
        </div>
      ) : <div className="mt-5 text-sm text-neutral-500">Фоновые задачи ещё не запускались.</div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string | null }) {
  return <div className="rounded-xl bg-[#f5f5f5] p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-bold text-[#222]">{value ?? "—"}</div></div>;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}
