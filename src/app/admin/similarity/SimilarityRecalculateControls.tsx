"use client";

import { useMemo, useState } from "react";

type RunState = "idle" | "running" | "done" | "error";

type ApiPayload = {
  ok?: boolean;
  error?: string;
  result?: unknown;
};

export function SimilarityRecalculateControls() {
  const [state, setState] = useState<RunState>("idle");
  const [activeLimit, setActiveLimit] = useState<number | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);

  const statusText = useMemo(() => {
    if (state === "running") return `Пересчёт запущен: ${activeLimit ?? "—"} фильмов. Не закрывай страницу до ответа.`;
    if (state === "done") return "Готово. Результат ниже.";
    if (state === "error") return "Ошибка пересчёта. Детали ниже.";
    return "Нажми кнопку — запрос выполнится без открытия новой вкладки.";
  }, [activeLimit, state]);

  async function run(limit: number) {
    setState("running");
    setActiveLimit(limit);
    setPayload(null);

    try {
      const response = await fetch(`/api/admin/similarity/recalculate?limit=${limit}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
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

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-[#e50914] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running"}
          onClick={() => run(300)}
        >
          {state === "running" && activeLimit === 300 ? "Считаю 300..." : "Пересчитать 300 фильмов"}
        </button>
        <button
          className="rounded-lg bg-[#333] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={state === "running"}
          onClick={() => run(1000)}
        >
          {state === "running" && activeLimit === 1000 ? "Считаю 1000..." : "Пересчитать 1000 фильмов"}
        </button>
      </div>

      <div className="rounded-lg border border-[#eee] bg-white px-4 py-3 text-sm text-neutral-700">
        {statusText}
      </div>

      {payload ? (
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#111] p-4 text-xs leading-relaxed text-white">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
