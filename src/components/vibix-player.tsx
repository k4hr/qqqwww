"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";

type VibixPlayerProps = {
  title?: string | null;
  kinopoiskId?: number | string | null;
  imdbId?: string | null;
  vibixId?: number | string | null;
  vibixType?: string | null;
  embedCode?: string | null;
  iframeUrl?: string | null;
  posterUrl?: string | null;
};

type VibixDataType = "movie" | "series" | "kp" | "imdb";
type VibixAttributes = {
  "data-publisher-id": string;
  "data-type": VibixDataType;
  "data-id": string;
  "data-season"?: string;
  "data-episodes"?: string;
  "data-voiceover"?: string;
  "data-voiceover-only"?: string;
  "data-design"?: string;
  "data-poster"?: string;
  "data-nopreload"?: string;
  "data-sync"?: string;
  "data-autoplay"?: string;
  "data-width"?: string;
  "data-height"?: string;
  "data-color1"?: string;
  "data-color2"?: string;
  "data-color3"?: string;
  "data-color4"?: string;
  "data-color5"?: string;
};

type VibixSdkWindow = Window & {
  Rendex?: { init?: () => void };
  rendex?: { init?: () => void };
  Vibix?: { init?: () => void };
};

const VIBIX_PUBLISHER_ID = "678353780";
const VIBIX_SDK_URL = "https://graphicslab.io/sdk/v2/rendex-sdk.min.js";
const VIBIX_DATA_TYPES = new Set<VibixDataType>(["movie", "series", "kp", "imdb"]);

const REDFILM_PLAYER_DEFAULT_ATTRS = {
  "data-design": "5",
  "data-poster": "true",
  "data-nopreload": "true",
  "data-color1": "#e50914",
  "data-color2": "#ffffff",
  "data-color3": "#a7a7b0",
  "data-color4": "#ff1f2d",
  "data-color5": "#050507",
} satisfies Partial<VibixAttributes>;

const OPTIONAL_VIBIX_PLAYER_ATTRS = [
  "data-season",
  "data-episodes",
  "data-voiceover",
  "data-voiceover-only",
  "data-design",
  "data-poster",
  "data-nopreload",
  "data-sync",
  "data-autoplay",
  "data-width",
  "data-height",
  "data-color1",
  "data-color2",
  "data-color3",
  "data-color4",
  "data-color5",
] as const;

function withRedfilmPlayerStyle(attrs: VibixAttributes, parsed: Record<`data-${string}`, string> = {}): VibixAttributes {
  const next: VibixAttributes = { ...attrs, ...REDFILM_PLAYER_DEFAULT_ATTRS };

  for (const key of OPTIONAL_VIBIX_PLAYER_ATTRS) {
    const value = parsed[key]?.trim();
    if (value) next[key] = value;
  }

  // REDFILM style should be applied even when the stored Vibix embed code only has id/type.
  next["data-design"] = next["data-design"] || REDFILM_PLAYER_DEFAULT_ATTRS["data-design"];
  next["data-poster"] = next["data-poster"] || REDFILM_PLAYER_DEFAULT_ATTRS["data-poster"];
  next["data-nopreload"] = next["data-nopreload"] || REDFILM_PLAYER_DEFAULT_ATTRS["data-nopreload"];
  return next;
}

export function parseEmbedCode(embedCode?: string | null) {
  const attributes: Record<`data-${string}`, string> = {};
  if (!embedCode) return attributes;

  const attributePattern = /([a-zA-Z0-9_-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of embedCode.matchAll(attributePattern)) {
    const key = match[1].toLowerCase();
    if (key.startsWith("data-") && match[3]) attributes[key as `data-${string}`] = match[3].trim();
  }
  return attributes;
}

function buildEmbedAttrs(embedCode?: string | null): VibixAttributes | null {
  if (!embedCode?.trim()) return null;
  const parsed = parseEmbedCode(embedCode);
  const type = parsed["data-type"]?.toLowerCase() as VibixDataType | undefined;
  const id = parsed["data-id"]?.trim();
  if (!type || !VIBIX_DATA_TYPES.has(type) || !id) return null;

  return withRedfilmPlayerStyle({
    "data-publisher-id": parsed["data-publisher-id"]?.trim() || VIBIX_PUBLISHER_ID,
    "data-type": type,
    "data-id": id,
  }, parsed);
}

function normalizeVibixDataType(value?: string | null): VibixDataType | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["serial", "series", "tv", "tv_series", "show"].includes(normalized)) return "series";
  if (["movie", "film", "cartoon", "anime"].includes(normalized)) return "movie";
  return null;
}

export function buildVibixAttrs({ kinopoiskId, imdbId, vibixId, vibixType, embedCode }: Pick<VibixPlayerProps, "kinopoiskId" | "imdbId" | "vibixId" | "vibixType" | "embedCode">): VibixAttributes | null {
  // IMPORTANT: prefer the exact Vibix/Rendex content id over old stored kp/imdb embeds.
  // A lot of migrated rows already have a vibixEmbedCode like data-type="kp"/"imdb".
  // Those attrs are syntactically valid, but Rendex often answers "content not added".
  // The official integration is data-type="movie|series" + Vibix content id.
  const storedVibixId = String(vibixId ?? "").trim();
  const storedVibixType = normalizeVibixDataType(vibixType);
  if (storedVibixId && storedVibixType) return withRedfilmPlayerStyle({ "data-publisher-id": VIBIX_PUBLISHER_ID, "data-type": storedVibixType, "data-id": storedVibixId });

  const embedAttrs = buildEmbedAttrs(embedCode);
  if (embedAttrs) return embedAttrs;

  const kpId = String(kinopoiskId ?? "").trim();
  if (kpId) return withRedfilmPlayerStyle({ "data-publisher-id": VIBIX_PUBLISHER_ID, "data-type": "kp", "data-id": kpId });

  const normalizedImdbId = imdbId?.trim();
  if (normalizedImdbId) return withRedfilmPlayerStyle({ "data-publisher-id": VIBIX_PUBLISHER_ID, "data-type": "imdb", "data-id": normalizedImdbId });

  return null;
}

function normalizeIframeUrl(iframeUrl?: string | null) {
  if (!iframeUrl?.trim()) return null;
  try {
    const url = new URL(iframeUrl.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function VibixPlayer({ title, kinopoiskId, imdbId, vibixId, vibixType, embedCode, iframeUrl, posterUrl }: VibixPlayerProps) {
  const attrs = useMemo(() => buildVibixAttrs({ kinopoiskId, imdbId, vibixId, vibixType, embedCode }), [kinopoiskId, imdbId, vibixId, vibixType, embedCode]);
  const attrsKey = attrs ? `${attrs["data-type"]}-${attrs["data-id"]}` : null;
  const normalizedIframeUrl = useMemo(() => normalizeIframeUrl(iframeUrl), [iframeUrl]);
  const [iframeFailed, setIframeFailed] = useState(false);
  const iframeTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (embedCode?.trim() && !buildEmbedAttrs(embedCode)) {
      console.warn("[VibixPlayer] Could not parse embedCode data-type/data-id");
    }
  }, [embedCode]);

  useEffect(() => {
    if (!attrs || !attrsKey) return;
    console.log("[VibixPlayer] attrs", attrs);

    const timeouts: number[] = [];
    const load = () => {
      try {
        window.dispatchEvent(new Event("resize"));
        const sdkWindow = window as VibixSdkWindow;
        sdkWindow.Rendex?.init?.();
        sdkWindow.rendex?.init?.();
        sdkWindow.Vibix?.init?.();
      } catch (error) {
        console.warn("[VibixPlayer] init failed", error);
      }
    };
    const logIframeSource = () => {
      const iframe = containerRef.current?.querySelector("iframe");
      console.log("[VibixPlayer] iframe src", iframe?.src);
    };
    const initializeWithRetries = () => {
      load();
      for (const delay of [500, 1_500, 3_000]) {
        timeouts.push(window.setTimeout(() => {
          load();
          if (delay >= 1_500) logIframeSource();
        }, delay));
      }
    };

    const existing = Array.from(document.scripts).find((script) => script.dataset.redfilmVibixSdk === "true" || script.src === VIBIX_SDK_URL) as HTMLScriptElement | undefined;
    let sdkScript: HTMLScriptElement | undefined = existing;
    const handleLoad = () => initializeWithRetries();
    const handleError = () => console.error("[VibixPlayer] Failed to load SDK", VIBIX_SDK_URL);
    if (!existing) {
      const script = document.createElement("script");
      script.src = VIBIX_SDK_URL;
      script.async = true;
      script.dataset.redfilmVibixSdk = "true";
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
      sdkScript = script;
    } else {
      existing.addEventListener("load", handleLoad, { once: true });
      initializeWithRetries();
    }

    return () => {
      sdkScript?.removeEventListener("load", handleLoad);
      sdkScript?.removeEventListener("error", handleError);
      for (const timeout of timeouts) window.clearTimeout(timeout);
    };
  }, [attrs, attrsKey]);

  useEffect(() => {
    setIframeFailed(false);
    if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
    if (attrs || !normalizedIframeUrl) return;

    iframeTimeoutRef.current = window.setTimeout(() => setIframeFailed(true), 10_000);
    return () => {
      if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
    };
  }, [attrs, normalizedIframeUrl]);

  if (attrs && attrsKey) {
    return (
      <div ref={containerRef} className="vibix-player-shell">
        <ins key={attrsKey} {...attrs} />
      </div>
    );
  }

  if (normalizedIframeUrl && !iframeFailed) {
    return (
      <div className="vibix-player-shell">
        <iframe
          src={normalizedIframeUrl}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          title={title || "REDFILM player"}
          onLoad={() => {
            if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
          }}
          onError={() => setIframeFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="vibix-player-shell poster-fallback relative flex flex-col items-center justify-center" style={posterUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.78), rgba(0,0,0,.9)), url(${posterUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,.24),transparent_45%)]" />
      <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/10 bg-[#e50914] shadow-[0_0_52px_rgba(229,9,20,.42)]">
        <Play fill="white" color="white" size={28} />
      </div>
      <p className="relative z-10 mt-5 px-5 text-center text-white/70">Источник плеера временно недоступен</p>
    </div>
  );
}
