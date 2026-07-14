"use client";

import { useEffect, useMemo, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import type { VibixAttributes } from "@/components/vibix-player";

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

const PUBLISHER_ID = "678353780";

export function VibixTrailer({ title, kinopoiskId, imdbId }: Props) {
  const [open, setOpen] = useState(false);

  const trailerAttrs = useMemo<VibixAttributes | null>(() => {
    const kpId = String(kinopoiskId ?? "").trim();
    const normalizedImdbId = String(imdbId ?? "").trim();

    // For trailers use external catalogue IDs only.
    // Reusing movie/series data-id can make the SDK open the full Vibix player.
    if (kpId) {
      return {
        "data-publisher-id": PUBLISHER_ID,
        "data-type": "kp",
        "data-id": kpId,
        "data-trailer": "only",
        "data-poster": "true",
        "data-nopreload": "true",
        "data-autoplay": "true",
        "data-design": "5",
        "data-color1": "#e50914",
        "data-color2": "#ffffff",
        "data-color3": "#a7a7b0",
        "data-color4": "#ff1f2d",
        "data-color5": "#050507",
      };
    }

    if (normalizedImdbId) {
      return {
        "data-publisher-id": PUBLISHER_ID,
        "data-type": "imdb",
        "data-id": normalizedImdbId,
        "data-trailer": "only",
        "data-poster": "true",
        "data-nopreload": "true",
        "data-autoplay": "true",
        "data-design": "5",
        "data-color1": "#e50914",
        "data-color2": "#ffffff",
        "data-color3": "#a7a7b0",
        "data-color4": "#ff1f2d",
        "data-color5": "#050507",
      };
    }

    return null;
  }, [kinopoiskId, imdbId]);

  useEffect(() => {
    if (!open || !trailerAttrs) return;

    const initialize = () => {
      const sdk = window as RendexWindow;
      sdk.Rendex?.init?.();
      window.dispatchEvent(new Event("resize"));
    };

    const timeouts = [0, 400, 1_200].map((delay) => window.setTimeout(initialize, delay));
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
            <ins
              key={`trailer-${trailerAttrs["data-type"]}-${trailerAttrs["data-id"]}`}
              {...trailerAttrs}
            />
          </div>
        </div>
      )}
    </div>
  );
}
