"use client";

import { useMemo, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { parseEmbedCode } from "@/components/vibix-player";

type Props = {
  title: string;
  kinopoiskId?: number | string | null;
  imdbId?: string | null;
  vibixId?: number | string | null;
  vibixType?: string | null;
  embedCode?: string | null;
};

type TrailerSource = {
  type: "movie" | "series" | "kp" | "imdb";
  id: string;
  publisherId: string;
};

const PUBLISHER_ID = "678353780";
const SDK_URL = "https://graphicslab.io/sdk/v2/rendex-sdk.min.js";

function normalizeCatalogType(value?: string | null): "movie" | "series" | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["series", "serial", "tv", "tv_series", "show"].includes(normalized)) return "series";
  if (["movie", "film", "cartoon", "anime"].includes(normalized)) return "movie";
  return null;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resolveTrailerSource({
  kinopoiskId,
  imdbId,
  vibixId,
  vibixType,
  embedCode,
}: Omit<Props, "title">): TrailerSource | null {
  const parsed = parseEmbedCode(embedCode);
  const parsedType = normalizeCatalogType(parsed["data-type"]);
  const parsedId = parsed["data-id"]?.trim();

  if (parsedType && parsedId) {
    return {
      publisherId: parsed["data-publisher-id"]?.trim() || PUBLISHER_ID,
      type: parsedType,
      id: parsedId,
    };
  }

  const storedType = normalizeCatalogType(vibixType);
  const storedId = String(vibixId ?? "").trim();
  if (storedType && storedId) {
    return { publisherId: PUBLISHER_ID, type: storedType, id: storedId };
  }

  const kpId = String(kinopoiskId ?? "").trim();
  if (kpId) return { publisherId: PUBLISHER_ID, type: "kp", id: kpId };

  const normalizedImdbId = String(imdbId ?? "").trim();
  if (normalizedImdbId) {
    return { publisherId: PUBLISHER_ID, type: "imdb", id: normalizedImdbId };
  }

  return null;
}

function buildTrailerDocument(source: TrailerSource, title: string) {
  const publisherId = escapeHtmlAttribute(source.publisherId);
  const type = escapeHtmlAttribute(source.type);
  const id = escapeHtmlAttribute(source.id);
  const safeTitle = escapeHtmlAttribute(title);

  /*
   * The trailer is intentionally rendered in an isolated document.
   * Rendex mutates <ins> nodes and keeps global player state. Rendering a
   * second <ins> dynamically in the same document can reuse the primary
   * movie instance and ignore data-trailer="only".
   *
   * Here the <ins> exists before the SDK is loaded, exactly like the
   * provider documentation example, and the trailer has its own SDK state.
   */
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Трейлер: ${safeTitle}</title>
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
    ins,iframe{display:block;width:100%!important;height:100%!important;min-height:100%!important;border:0}
  </style>
</head>
<body>
  <ins
    data-publisher-id="${publisherId}"
    data-type="${type}"
    data-id="${id}"
    data-trailer="only"
    data-autoplay="true"
    data-poster="true"
    data-design="5"
    data-color1="#e50914"
    data-color2="#ffffff"
    data-color3="#a7a7b0"
    data-color4="#ff1f2d"
    data-color5="#050507"
    data-width="100%"
    data-height="100%"
  ></ins>
  <script src="${SDK_URL}"></script>
</body>
</html>`;
}

export function VibixTrailer(props: Props) {
  const [open, setOpen] = useState(false);

  const source = useMemo(
    () => resolveTrailerSource(props),
    [props.kinopoiskId, props.imdbId, props.vibixId, props.vibixType, props.embedCode],
  );

  const srcDoc = useMemo(
    () => (source ? buildTrailerDocument(source, props.title) : null),
    [source, props.title],
  );

  if (!source || !srcDoc) return null;

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

          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              key={`trailer-${source.type}-${source.id}`}
              srcDoc={srcDoc}
              title={`Трейлер: ${props.title}`}
              className="h-full w-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          </div>
        </div>
      )}
    </div>
  );
}
