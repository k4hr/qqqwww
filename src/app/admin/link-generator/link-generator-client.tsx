"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  LINK_GENERATOR_BUCKET_META,
  LINK_GENERATOR_BUCKETS,
  LINK_GENERATOR_CONTENT_TYPES,
  type LinkGeneratorBucket,
  type LinkGeneratorBucketCounts,
  type LinkGeneratorContentType,
  type LinkGeneratorItem,
  type LinkGeneratorStats,
} from "@/lib/link-generator-types";

const TYPE_LABELS: Record<LinkGeneratorContentType, string> = {
  MOVIE: "Фильмы",
  SERIES: "Сериалы",
  CARTOON: "Мультфильмы",
  ANIME: "Аниме",
};

const ITEM_TYPE_LABELS: Record<LinkGeneratorContentType, string> = {
  MOVIE: "фильм",
  SERIES: "сериал",
  CARTOON: "мультфильм",
  ANIME: "аниме",
};

type ResultState = Record<LinkGeneratorBucket | "MIXED", LinkGeneratorItem[]>;
type PendingState = LinkGeneratorBucket | "MIXED" | "STATS" | "START_CONTINUOUS" | null;
type ViewerLaunchTarget = "VIEWER_01" | "VIEWER_02" | "BOTH";

const MIXED_TOTAL = 40;

function emptyResults(): ResultState {
  return { MIN_1_10: [], MIN_11_30: [], MIN_31_60: [], MIN_61_PLUS: [], MIXED: [] };
}

export function LinkGeneratorClient({
  initialStats,
  initialTypes,
}: {
  initialStats: LinkGeneratorStats;
  initialTypes: LinkGeneratorContentType[];
}) {
  const [types, setTypes] = useState<LinkGeneratorContentType[]>(initialTypes);
  const [stats, setStats] = useState(initialStats);
  const [counts, setCounts] = useState<Record<LinkGeneratorBucket, number>>({
    MIN_1_10: 10,
    MIN_11_30: 10,
    MIN_31_60: 10,
    MIN_61_PLUS: 10,
  });
  const [mixedCounts, setMixedCounts] = useState<LinkGeneratorBucketCounts>({
    MIN_1_10: 10,
    MIN_11_30: 10,
    MIN_31_60: 10,
    MIN_61_PLUS: 10,
  });
  const [results, setResults] = useState<ResultState>(emptyResults);
  const [pending, setPending] = useState<PendingState>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);

  const allTypesSelected = types.length === LINK_GENERATOR_CONTENT_TYPES.length;
  const totalEligible = useMemo(
    () => LINK_GENERATOR_BUCKETS.reduce((sum, bucket) => sum + stats[bucket], 0),
    [stats],
  );
  const mixedTotal = useMemo(
    () => LINK_GENERATOR_BUCKETS.reduce((sum, bucket) => sum + mixedCounts[bucket], 0),
    [mixedCounts],
  );
  const mixedCountsFitAvailability = LINK_GENERATOR_BUCKETS.every(
    (bucket) => mixedCounts[bucket] <= stats[bucket],
  );
  const mixedCanGenerate = mixedTotal === MIXED_TOTAL && mixedCountsFitAvailability;

  async function refreshStats(nextTypes: LinkGeneratorContentType[]) {
    setPending("STATS");
    setMessage("");
    try {
      const query = new URLSearchParams({ types: nextTypes.join(",") });
      const response = await fetch(`/api/admin/link-generator/stats?${query.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { stats?: LinkGeneratorStats; error?: string };
      if (!response.ok || !payload.stats) throw new Error(payload.error || "Не удалось обновить статистику");
      setStats(payload.stats);
      setResults(emptyResults());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить статистику");
    } finally {
      setPending(null);
    }
  }

  function toggleType(type: LinkGeneratorContentType) {
    const next = types.includes(type) ? types.filter((item) => item !== type) : [...types, type];
    if (!next.length) {
      setMessage("Оставь включённым хотя бы один тип контента.");
      return;
    }
    setTypes(next);
    void refreshStats(next);
  }

  function toggleAllTypes() {
    const next = allTypesSelected ? ["MOVIE"] as LinkGeneratorContentType[] : [...LINK_GENERATOR_CONTENT_TYPES];
    setTypes(next);
    void refreshStats(next);
  }

  function changeMixedCount(bucket: LinkGeneratorBucket, value: string) {
    const parsed = Number.parseInt(value || "0", 10);
    const nextValue = Number.isFinite(parsed) ? Math.min(MIXED_TOTAL, Math.max(0, parsed)) : 0;
    setMixedCounts((current) => ({ ...current, [bucket]: nextValue }));
    setResults((current) => ({ ...current, MIXED: [] }));
    setCopied(null);
    setMessage("");
  }

  async function generate(target: LinkGeneratorBucket | "MIXED") {
    setPending(target);
    setMessage("");
    setCopied(null);
    try {
      const body = target === "MIXED"
        ? { mode: "mixed", bucketCounts: mixedCounts, types }
        : { mode: "bucket", bucket: target, count: counts[target], types };
      const response = await fetch("/api/admin/link-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { items?: LinkGeneratorItem[]; error?: string };
      if (!response.ok || !payload.items) throw new Error(payload.error || "Не удалось сгенерировать ссылки");
      setResults((current) => ({ ...current, [target]: payload.items ?? [] }));
      if (payload.items.length < (target === "MIXED" ? mixedTotal : counts[target])) {
        setMessage(`Найдено только ${payload.items.length} уникальных ссылок по выбранным условиям.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка генерации ссылок");
    } finally {
      setPending(null);
    }
  }

  function reshuffleMixed() {
    const shuffled = [...results.MIXED];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    setResults((current) => ({ ...current, MIXED: shuffled }));
  }

  async function startContinuousTest(target: ViewerLaunchTarget) {
    if (results.MIXED.length !== MIXED_TOTAL || mixedTotal !== MIXED_TOTAL) {
      setMessage("Сначала сгенерируй полный набор из 40 ссылок.");
      return;
    }

    setPending("START_CONTINUOUS");
    setMessage("");
    try {
      const response = await fetch("/api/admin/link-generator/start-continuous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          bucketCounts: mixedCounts,
          types,
          items: results.MIXED,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        viewerCount?: number;
        targets?: Array<{ label?: string }>;
      };
      if (!response.ok) throw new Error(payload.error || "Не удалось запустить постоянный тест");

      const labels = payload.targets?.map((item) => item.label).filter(Boolean).join(" и ");
      const viewerCount = payload.viewerCount ?? (target === "BOTH" ? 80 : 40);
      setMessage(
        `Постоянный тест отправлен в ${labels || (target === "BOTH" ? "обе ноды" : target === "VIEWER_02" ? "Viewer 02" : "Viewer 01")}: ${viewerCount} зрителей будут автоматически получать новые ссылки своего диапазона.`,
      );
      setLaunchDialogOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось запустить постоянный тест");
    } finally {
      setPending(null);
    }
  }

  async function copyLinks(key: LinkGeneratorBucket | "MIXED") {
    const text = results[key].map((item) => item.url).join("\n");
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copiedSuccessfully = document.execCommand("copy");
        textarea.remove();
        if (!copiedSuccessfully) throw new Error("copy_failed");
      }
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
    } catch {
      setMessage("Браузер не разрешил копирование. Выдели ссылки вручную.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="admin-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#222]">Типы контента</h2>
            <p className="mt-1 text-sm text-neutral-500">Фильтры применяются ко всем блокам и к смешанному набору.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LINK_GENERATOR_CONTENT_TYPES.map((type) => (
              <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${types.includes(type) ? "border-[#e50914] bg-[#fff1f2] text-[#b40710]" : "border-[#ddd] bg-white text-[#555]"}`}>
                <input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} className="accent-[#e50914]" />
                {TYPE_LABELS[type]}
              </label>
            ))}
            <button type="button" onClick={toggleAllTypes} className="rounded-xl border border-[#ccc] px-4 py-2 text-sm font-bold text-[#333] hover:bg-[#f5f5f5]">
              {allTypesSelected ? "Только фильмы" : "Выбрать все"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Подходящих ссылок" value={totalEligible} />
          <Stat label="Без длительности" value={stats.UNKNOWN} />
          <Stat label="Выбрано типов" value={types.length} />
        </div>
      </section>

      <section className="rounded-2xl border-2 border-[#e50914] bg-[#fff7f7] p-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#e50914]">Главный блок</div>
              <h2 className="mt-1 text-2xl font-black text-[#222]">Замешать 40 ссылок</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Укажи, сколько ссылок взять из каждого диапазона. Сумма должна быть ровно 40, после чего итоговый список полностью перемешивается.
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-center ${mixedTotal === MIXED_TOTAL ? "border-[#9ed1aa] bg-[#eefaf1]" : "border-[#e7b0b3] bg-white"}`}>
              <div className="text-xs font-black uppercase tracking-wide text-neutral-500">Итого</div>
              <div className={`mt-1 text-2xl font-black ${mixedTotal === MIXED_TOTAL ? "text-[#176b2c]" : "text-[#b40710]"}`}>{mixedTotal} / {MIXED_TOTAL}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {LINK_GENERATOR_BUCKETS.map((bucket) => {
              const meta = LINK_GENERATOR_BUCKET_META[bucket];
              const unavailable = mixedCounts[bucket] > stats[bucket];
              return (
                <label key={`mixed-${bucket}`} className={`rounded-xl border bg-white p-3 text-sm font-bold ${unavailable ? "border-[#e50914]" : "border-[#e1c7c9]"}`}>
                  <span className="text-[#333]">{meta.title}</span>
                  <input
                    type="number"
                    min={0}
                    max={MIXED_TOTAL}
                    value={mixedCounts[bucket]}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => changeMixedCount(bucket, event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#d8d8d8] bg-white px-3 py-2 text-lg font-black text-[#222] outline-none focus:border-[#e50914]"
                  />
                  <span className={`mt-1 block text-xs ${unavailable ? "text-[#b40710]" : "text-neutral-500"}`}>
                    Доступно: {stats[bucket].toLocaleString("ru-RU")}
                  </span>
                </label>
              );
            })}
          </div>

          {mixedTotal !== MIXED_TOTAL ? (
            <div className="rounded-xl border border-[#e7b0b3] bg-white px-4 py-3 text-sm font-bold text-[#9f1018]">
              Нужно распределить ровно 40 ссылок. Сейчас указано: {mixedTotal}.
            </div>
          ) : !mixedCountsFitAvailability ? (
            <div className="rounded-xl border border-[#e7b0b3] bg-white px-4 py-3 text-sm font-bold text-[#9f1018]">
              В одном из диапазонов запрошено больше ссылок, чем доступно. Уменьши значение.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(pending) || !mixedCanGenerate} onClick={() => generate("MIXED")} className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white disabled:opacity-50">
              {pending === "MIXED" ? "Генерируем…" : results.MIXED.length ? "Новый набор из 40" : "Сгенерировать 40 ссылок"}
            </button>
            <button type="button" disabled={!results.MIXED.length || Boolean(pending)} onClick={reshuffleMixed} className="rounded-xl border border-[#d7a2a5] bg-white px-5 py-3 font-bold text-[#8f0a12] disabled:opacity-40">
              Перемешать порядок
            </button>
            <button type="button" disabled={!results.MIXED.length} onClick={() => copyLinks("MIXED")} className="rounded-xl bg-[#222] px-5 py-3 font-bold text-white disabled:opacity-40">
              {copied === "MIXED" ? "Скопировано" : `Скопировать ${results.MIXED.length || 40}`}
            </button>
            <button
              type="button"
              disabled={results.MIXED.length !== MIXED_TOTAL || Boolean(pending)}
              onClick={() => setLaunchDialogOpen(true)}
              className="rounded-xl bg-[#176b2c] px-5 py-3 font-black text-white disabled:opacity-40"
            >
              {pending === "START_CONTINUOUS" ? "Отправляем…" : "Запустить постоянный тест"}
            </button>
          </div>
        </div>
        <ResultList items={results.MIXED} emptyText="Настрой количество для каждого диапазона и нажми «Сгенерировать 40 ссылок»." />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {LINK_GENERATOR_BUCKETS.map((bucket) => {
          const meta = LINK_GENERATOR_BUCKET_META[bucket];
          const items = results[bucket];
          return (
            <section key={bucket} className="admin-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#222]">{meta.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-neutral-500">{meta.description}</p>
                </div>
                <div className="shrink-0 rounded-full bg-[#f1f1f1] px-3 py-1 text-sm font-black text-[#333]">{stats[bucket]}</div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm font-bold text-[#444]">
                  Количество ссылок
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={counts[bucket]}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setCounts((current) => ({ ...current, [bucket]: Math.min(200, Math.max(1, Number.parseInt(event.target.value || "1", 10))) }))}
                    className="mt-1 w-full rounded-xl border border-[#d8d8d8] bg-white px-4 py-3 text-[#222] outline-none focus:border-[#e50914]"
                  />
                </label>
                <button type="button" disabled={Boolean(pending) || stats[bucket] === 0} onClick={() => generate(bucket)} className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white disabled:opacity-40">
                  {pending === bucket ? "Генерируем…" : items.length ? "Новый набор" : "Сгенерировать"}
                </button>
                <button type="button" disabled={!items.length} onClick={() => copyLinks(bucket)} className="rounded-xl bg-[#222] px-5 py-3 font-bold text-white disabled:opacity-40">
                  {copied === bucket ? "Скопировано" : "Скопировать"}
                </button>
              </div>

              <ResultList items={items} emptyText="Список пока не сгенерирован." />
            </section>
          );
        })}
      </div>

      {message ? <div className="rounded-xl border border-[#e6b600] bg-[#fff9d8] p-4 text-sm font-bold text-[#5d4a00]">{message}</div> : null}
      {pending === "STATS" ? <div className="text-sm font-bold text-neutral-500">Обновляем статистику…</div> : null}

      {launchDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewer-launch-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && pending !== "START_CONTINUOUS") {
              setLaunchDialogOpen(false);
            }
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#e50914]">Выбор ноды</div>
                <h2 id="viewer-launch-title" className="mt-1 text-2xl font-black text-[#222]">Куда отправить зрителей?</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Для обеих нод REDFILM автоматически соберёт второй отдельный набор из 40 ссылок без пересечений с первым.
                </p>
              </div>
              <button
                type="button"
                disabled={pending === "START_CONTINUOUS"}
                onClick={() => setLaunchDialogOpen(false)}
                className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-black text-[#555] disabled:opacity-40"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <ViewerLaunchButton
                title="Viewer 01"
                subtitle="169.58.110.224 · 40 зрителей"
                disabled={pending === "START_CONTINUOUS"}
                onClick={() => void startContinuousTest("VIEWER_01")}
              />
              <ViewerLaunchButton
                title="Viewer 02"
                subtitle="169.58.120.30 · 40 зрителей · Proxy 02"
                disabled={pending === "START_CONTINUOUS"}
                onClick={() => void startContinuousTest("VIEWER_02")}
              />
              <ViewerLaunchButton
                title="Обе ноды"
                subtitle="80 зрителей · разные стартовые ссылки на каждой ноде"
                disabled={pending === "START_CONTINUOUS"}
                onClick={() => void startContinuousTest("BOTH")}
                emphasized
              />
            </div>

            {pending === "START_CONTINUOUS" ? (
              <div className="mt-4 rounded-xl bg-[#f4f4f4] px-4 py-3 text-sm font-bold text-[#444]">
                Отправляем конфигурацию и стартовые ссылки…
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ViewerLaunchButton({
  title,
  subtitle,
  disabled,
  onClick,
  emphasized = false,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  onClick: () => void;
  emphasized?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition disabled:opacity-40 ${
        emphasized
          ? "border-[#176b2c] bg-[#eef9f1] hover:bg-[#e4f5e8]"
          : "border-[#ddd] bg-white hover:border-[#e50914] hover:bg-[#fff7f7]"
      }`}
    >
      <div className="text-lg font-black text-[#222]">{title}</div>
      <div className="mt-1 text-sm font-medium text-neutral-500">{subtitle}</div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#f6f6f6] p-3"><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 text-2xl font-black text-[#222]">{value.toLocaleString("ru-RU")}</div></div>;
}

function ResultList({ items, emptyText }: { items: LinkGeneratorItem[]; emptyText: string }) {
  if (!items.length) return <div className="mt-4 rounded-xl border border-dashed border-[#ccc] bg-white/70 p-5 text-center text-sm text-neutral-500">{emptyText}</div>;

  return (
    <div className="mt-4 max-h-[430px] overflow-auto rounded-xl border border-[#ddd] bg-white">
      <ol className="divide-y divide-[#eee]">
        {items.map((item, index) => (
          <li key={`${item.id}-${index}`} className="p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-black text-[#777]">{index + 1}.</span>
              <span className="font-black text-[#222]">{item.title}</span>
              <span className="text-neutral-500">{ITEM_TYPE_LABELS[item.type]} · {item.duration} мин.</span>
            </div>
            <div className="mt-1 break-all font-mono text-xs text-[#b40710]">{item.url}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
