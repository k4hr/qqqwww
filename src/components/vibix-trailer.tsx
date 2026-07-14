"use client";

import { useEffect, useMemo, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { buildVibixAttrs, type VibixAttributes } from "@/components/vibix-player";

type Props = {
  title: string;
  kinopoiskId?: number | string | null;
  imdbId?: string | null;
  vibixId?: number | string | null;
  vibixType?: string | null;
  embedCode?: string | null;
};

type RendexWindow = Window & {
  Rendex?: { init?: () => void };
  rendex?: { init?: () => void };
  Vibix?: { init?: () => void };
};

export function VibixTrailer({ title, kinopoiskId, imdbId, vibixId, vibixType, embedCode }: Props) {
  const [open, setOpen] = useState(false);
  const baseAttrs = useMemo(
    () => buildVibixAttrs({ kinopoiskId, imdbId, vibixId, vibixType, embedCode }),
    [kinopoiskId, imdbId, vibixId, vibixType, embedCode],
  );

  const trailerAttrs = useMemo<VibixAttributes | null>(() => {
    if (!baseAttrs) return null;
    return {
      ...baseAttrs,
      "data-trailer": "only",
      "data-poster": "true",
      "data-nopreload": "true",
      "data-autoplay": "true",
    };
  }, [baseAttrs]);

  useEffect(() => {
    if (!open || !trailerAttrs) return;

    const initialize = () => {
      const sdk = window as RendexWindow;
      sdk.Rendex?.init?.();
      sdk.rendex?.init?.();
      sdk.Vibix?.init?.();
      window.dispatchEvent(new Event("resize"));
    };

    const timeouts = [0, 350, 1_000, 2_000].map((delay) => window.setTimeout(initialize, delay));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [open, trailerAttrs]);

  if (!trailerAttrs) return null;

  return (
    <div className="border-t border-white/10 bg-[#09090c] px-4 py-4 sm:px-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-4 py-2.5 text-sm font-black text-white transition hover:border-[#e50914]/70 hover:bg-[#e50914]/10"
          aria-expanded="false"
        >
          <Clapperboard size={18} />
          Смотреть трейлер
        </button>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-base font-black text-white">Трейлер: {title}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Закрыть трейлер"
            >
              <X size={18} />
            </button>
          </div>
          <div className="vibix-player-shell overflow-hidden rounded-2xl bg-black">
            <ins key={`trailer-${trailerAttrs["data-type"]}-${trailerAttrs["data-id"]}`} {...trailerAttrs} />
          </div>
        </div>
      )}
    </div>
  );
}
