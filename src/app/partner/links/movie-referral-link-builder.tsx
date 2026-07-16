"use client";

import { useMemo, useState } from "react";

function extractWatchSlug(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== "watch") return null;
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

export function MovieReferralLinkBuilder({ partnerSlug }: { partnerSlug: string }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [message, setMessage] = useState("");

  const example = useMemo(
    () => `https://redfilm.win/watch/chuzhestranka-2014/${partnerSlug}`,
    [partnerSlug],
  );

  async function generateAndCopy() {
    const movieSlug = extractWatchSlug(sourceUrl);
    if (!movieSlug) {
      setResultUrl("");
      setMessage("Вставьте ссылку REDFILM вида https://redfilm.win/watch/nazvanie-2024");
      return;
    }

    const referralUrl = `${window.location.origin}/watch/${encodeURIComponent(movieSlug)}/${encodeURIComponent(partnerSlug)}`;
    setResultUrl(referralUrl);

    try {
      await navigator.clipboard.writeText(referralUrl);
      setMessage("Партнёрская ссылка создана и скопирована.");
    } catch {
      setMessage("Ссылка создана. Скопируйте её кнопкой ниже.");
    }
  }

  async function copyResult() {
    if (!resultUrl) return;
    await navigator.clipboard.writeText(resultUrl);
    setMessage("Скопировано.");
  }

  return (
    <section className="mf-panel p-5">
      <h2 className="text-xl font-black text-white">Отдельные ссылки на фильмы и сериалы</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#a1a1aa]">
        Вставьте обычную ссылку на страницу фильма или сериала REDFILM. Система сама добавит ваш партнёрский код и скопирует готовую ссылку.
      </p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <input
          type="url"
          value={sourceUrl}
          onChange={(event) => {
            setSourceUrl(event.target.value);
            setMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void generateAndCopy();
            }
          }}
          placeholder="https://redfilm.win/watch/chuzhestranka-2014"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#e50914]"
        />
        <button
          type="button"
          onClick={() => void generateAndCopy()}
          className="rounded-xl bg-[#e50914] px-5 py-3 text-sm font-black text-white hover:bg-[#c9000b]"
        >
          Создать и скопировать
        </button>
      </div>

      {resultUrl ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">Готовая партнёрская ссылка</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-black/35 px-3 py-2 text-sm text-white">{resultUrl}</code>
            <button
              type="button"
              onClick={() => void copyResult()}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-white hover:bg-white/10"
            >
              Скопировать
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm font-bold text-[#ff6b72]">{message}</p> : null}

      <p className="mt-4 text-xs leading-relaxed text-[#71717a]">
        Пример готовой ссылки: <span className="break-all text-[#a1a1aa]">{example}</span>
      </p>
    </section>
  );
}
