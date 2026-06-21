"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const actions = [
  ["Запустить полный Trend Sync", "/api/admin/trends/run"],
  ["Проверить кандидатов в Vibix", "/api/admin/trends/check-vibix"],
  ["Пересчитать home scores", "/api/admin/trends/recalculate-scores"],
  ["Пересчитать Quality Gate", "/api/admin/trends/recalculate-scores"],
] as const;

export function TrendControls() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function run(label: string, url: string) {
    setPending(url);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchSize: 25 }) });
      const data = await response.json();
      setMessage(response.ok ? JSON.stringify(data) : data.error || "Ошибка запуска");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка сети"); }
    finally { setPending(null); }
  }
  return <div>
    <div className="flex flex-wrap gap-2">{actions.map(([label, url]) => <button key={label} disabled={Boolean(pending)} onClick={() => run(label, url)} className="rounded-lg bg-[#e50914] px-4 py-3 font-bold text-white disabled:opacity-50">{pending === url ? "Выполняется…" : label}</button>)}</div>
    {message ? <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-[#f5f5f5] p-3 text-xs text-[#222] whitespace-pre-wrap">{message}</pre> : null}
  </div>;
}
