"use client";

import { useEffect, useMemo, useState } from "react";

type RunState = "idle" | "running" | "done" | "error";

type Job = {
  id: string;
  status: string;
  mode: string;
  total: number | null;
  processed: number;
  saved: number;
  deleted: number;
  errors: number;
  batchSize: number;
  targetLimit: number;
  minScore: number;
  lastMovieTitle: string | null;
  message: string | null;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Snapshot = {
  latestJob: Job | null;
  dirtyCount: number;
  totalPublic: number;
  hasCachedSources: boolean;
  linksCount: number;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  result?: unknown;
  snapshot?: Snapshot;
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

function isActiveJob(job: Job | null | undefined) {
  return job ? ["QUEUED", "RUNNING", "PAUSED"].includes(job.status) : false;
}

export function SimilarityRecalculateControls({ initialSnapshot }: { initialSnapshot?: Snapshot }) {
  const [state, setState] = useState<RunState>("idle");
  const [payload, setPayload] = useState<ApiPayload | null>(initialSnapshot ? { ok: true, snapshot: initialSnapshot } : null);

  const snapshot = payload?.snapshot ?? initialSnapshot ?? null;
  const job = snapshot?.latestJob ?? null;
  const active = isActiveJob(job);

  const statusText = useMemo(() => {
    if (state === "running") return "Запрос выполняется. Задача создаётся/обновляется в базе.";
    if (state === "done") return "Готово. Статус ниже.";
    if (state === "error") return "Ошибка. Детали ниже.";
    if (active) return "Есть активная фоновая задача. Worker будет сам считать батчами.";
    return "Создай фоновую задачу: дальше similarity-worker будет считать сам, без ручного кликанья.";
  }, [active, state]);

  async function call(url: string, options: RequestInit = {}) {
    setState("running");
    try {
      const response = await fetch(url, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers ?? {}) },
        cache: "no-store",
        body: options.body,
      });
      const json = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok || !json?.ok) {
        setPayload(json ?? { ok: false, error: `HTTP ${response.status}` });
        setState("error");
        return;
      }
      setPayload(json);
      setState("done");
    } catch (error) {
      setPayload({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
      setState("error");
    }
  }

  async function refresh() {
    setState("running");
    try {
      const response = await fetch("/api/admin/similarity/jobs", { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
      const json = (await response.json().catch(() => null)) as ApiPayload | null;
      setPayload(json ?? { ok: false, error: `HTTP ${response.status}` });
      setState(response.ok && json?.ok ? "done" : "error");
    } catch (error) {
      setPayload({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
      setState("error");
    }
  }

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void refresh(), 6000);
    return () => window.clearInterval(timer);
  }, [active]);

  const progressPercent = job?.total && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat title="Всего для похожести" value={formatNumber(snapshot?.totalPublic)} />
        <MiniStat title="Ждут пересчёта" value={formatNumber(snapshot?.dirtyCount)} accent={Boolean(snapshot?.dirtyCount)} />
        <MiniStat title="Связей в кеше" value={formatNumber(snapshot?.linksCount)} />
        <MiniStat title="Последняя задача" value={job ? `${job.status} · ${job.mode}` : "нет"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-[#e50914] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running" || active}
          onClick={() => call("/api/admin/similarity/jobs", { body: JSON.stringify({ mode: "DIRTY", batchSize: 100 }) })}
        >
          Найти похожие для новых
        </button>
        <button
          className="rounded-lg bg-[#333] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running" || active}
          onClick={() => call("/api/admin/similarity/jobs", { body: JSON.stringify({ mode: "ALL", batchSize: 100, force: false }) })}
        >
          Полный пересчёт похожих
        </button>
        <button
          className="rounded-lg border border-[#ddd] bg-white px-5 py-3 font-bold text-[#222] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running"}
          onClick={() => call("/api/admin/similarity/jobs", { body: JSON.stringify({ action: "process-once" }) })}
        >
          Обработать 1 батч сейчас
        </button>
        <button
          className="rounded-lg border border-[#ddd] bg-white px-5 py-3 font-bold text-[#222] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running"}
          onClick={() => void refresh()}
        >
          Обновить статус
        </button>
        <button
          className="rounded-lg border border-[#ffb3b3] bg-white px-5 py-3 font-bold text-[#e50914] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running" || !active}
          onClick={() => call("/api/admin/similarity/jobs/cancel")}
        >
          Отменить задачу
        </button>
      </div>

      <div className="rounded-lg border border-[#eee] bg-white px-4 py-3 text-sm text-neutral-700">
        {statusText}
      </div>

      {job ? (
        <div className="rounded-xl border border-[#eee] bg-white p-4 text-sm text-[#222]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <b>Задача: {job.status} · {job.mode}</b>
            <span className="text-neutral-500">batch {job.batchSize} · target {job.targetLimit}</span>
          </div>
          <div className="mb-3 h-3 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[#e50914]" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MiniStat title="Всего" value={formatNumber(job.total)} />
            <MiniStat title="Обработано" value={formatNumber(job.processed)} />
            <MiniStat title="Сохранено связей" value={formatNumber(job.saved)} />
            <MiniStat title="Ошибок" value={formatNumber(job.errors)} accent={job.errors > 0} />
            <MiniStat title="Последний фильм" value={job.lastMovieTitle || "—"} />
          </div>
          {job.message ? <div className="mt-3 rounded-lg bg-neutral-100 p-3">{job.message}</div> : null}
          {job.lastError ? <div className="mt-3 rounded-lg bg-red-50 p-3 text-[#e50914]">{job.lastError}</div> : null}
        </div>
      ) : null}

      {payload ? (
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#111] p-4 text-xs leading-relaxed text-white">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}

      <div className="rounded-lg bg-[#fff7e6] p-3 text-sm text-[#7a4b00]">
        В daily pipeline dirty-фильмы обрабатывает <code>npm run vibix:catalog-worker</code>. Отдельный <code>npm run similarity:worker</code> можно оставить как ускоритель, но он больше не обязателен для ежедневного сценария.
      </div>
    </div>
  );
}

function MiniStat({ title, value, accent = false }: { title: string; value: string | number | undefined; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[#eee] bg-[#fafafa] p-3">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className={`mt-1 font-black ${accent ? "text-[#e50914]" : "text-[#111]"}`}>{value ?? "—"}</div>
    </div>
  );
}
