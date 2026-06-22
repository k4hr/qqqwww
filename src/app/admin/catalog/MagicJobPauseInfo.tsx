"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(ms: number) {
  if (ms <= 0) return "пауза уже прошла";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours} ч ${restMinutes} мин`;
  }
  if (minutes > 0) return `${minutes} мин ${seconds} сек`;
  return `${seconds} сек`;
}

function formatLocalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function MagicJobPauseInfo({
  status,
  pauseUntil,
  updatedAt,
}: {
  status: string | null;
  pauseUntil: string | null;
  updatedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pause = useMemo(() => {
    if (!pauseUntil) return null;
    const timestamp = new Date(pauseUntil).getTime();
    if (Number.isNaN(timestamp)) return null;
    return { timestamp, remaining: timestamp - now };
  }, [now, pauseUntil]);

  if (!pauseUntil || !pause) {
    return (
      <div className="mt-1">
        <b>Пауза:</b> нет
        {updatedAt ? <span className="ml-2 text-neutral-500">Последнее обновление: {formatLocalDate(updatedAt)}</span> : null}
      </div>
    );
  }

  const expired = pause.remaining <= 0;

  return (
    <div className="mt-1">
      <b>Пауза:</b>{" "}
      <span className={expired ? "font-bold text-green-700" : "font-bold text-amber-700"}>
        {expired ? "прошла" : `осталось ${formatDuration(pause.remaining)}`}
      </span>
      <span className="ml-2 text-neutral-500">до {formatLocalDate(pauseUntil)} по времени браузера</span>
      {status === "PAUSED" && expired ? (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
          Пауза уже прошла. Worker должен продолжить сам при следующем цикле. Также можно нажать “Продолжить сейчас”.
        </div>
      ) : null}
      {updatedAt ? <div className="mt-1 text-neutral-500">Последнее обновление задачи: {formatLocalDate(updatedAt)}</div> : null}
    </div>
  );
}
