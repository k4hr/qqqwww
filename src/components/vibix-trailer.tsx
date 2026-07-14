"use client";

import { useEffect, useMemo, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { parseEmbedCode, type VibixAttributes } from "@/components/vibix-player";

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

function normalizeCatalogType(value?: string | null): "movie" | "series" | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["series", "serial", "tv", "tv_series", "show"].includes(normalized)) return "series";
  if (["movie", "film", "cartoon", "anime"].includes(normalized)) return "movie";
  return null;
}

function buildTrailerAttrs({
  kinopoiskId,
  imdbId,
  vibixId,
  vibixType,
  embedCode,
}: Omit<Props, "title">): VibixAttributes | null {
  /*
   * The Rendex documentation explicitly supports trailers for movie/series
   * only with data-trailer="only". Therefore the exact catalogue type/id from
   * the stored Vibix embed code must be reused instead of switching to kp/imdb.
   */
  const parsed = parseEmbedCode(embedCode);
  const parsedType = normalizeCatalogType(parsed["data-type"]);
  const parsedId = parsed["data-id"]?.trim();

  if (parsedType && parsedId) {
    return {
      "data-publisher-id": parsed["data-publisher-id"]?.trim() || PUBLISHER_ID,
      "data-type": parsedType,
      "data-id": parsedId,
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

  const normalizedVibixType = normalizeCatalogType(vibixType);
  const normalizedVibixId = String(vibixId ?? "").trim();

  if (normalizedVibixType && normalizedVibixId) {
    return {
      "data-publisher-id": PUBLISHER_ID,
      "data-type": normalizedVibixType,
      "data-id": normalizedVibixId,
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

  // Only use external IDs as a final fallback when no verified Vibix
  // movie/series catalogue id exists.
  const kpId = String(kinopoiskId ?? "").trim();
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
    };
  }

  const normalizedImdbId = String(imdbId ?? "").trim();
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
    };
  }

  return null;
}

export function VibixTrailer(props: Props) {
  const [open, setOpen] = useState(false);

  const trailerAttrs = useMemo(
    () => buildTrailerAttrs(props),
    [props.kinopoiskId, props.imdbId, props.vibixId, props.vibixType, props.embedCode],
  );

  useEffect(() => {
    if (!open || !trailerAttrs) return;

    const initialize = () => {
      const sdk = window as RendexWindow;
      sdk.Rendex?.init?.();
      sdk.rendex?.init?.();
      sdk.Vibix?.init?.();
      window.dispatchEvent(new Event("resize"));
    };

    const timeouts = [0, 300, 900, 1_800].map((delay) =>
      window.setTimeout(initialize, delay),
    );

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
            <h3 className="min-w-0 break-words text-base font-black text-white">
              Трейлер: {props.title}
            </h3>
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
