"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";

type VibixPlayerProps = {
  iframeUrl?: string | null;
  embedCode?: string | null;
  title?: string | null;
};

type RendexWindow = Window & {
  Rendex?: { init?: () => void };
  rendex?: { init?: () => void };
};

export function parseEmbedCode(embedCode?: string | null) {
  const attributes: Record<`data-${string}`, string> = {};
  if (!embedCode) return attributes;

  const attributePattern = /([a-zA-Z0-9_-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of embedCode.matchAll(attributePattern)) {
    const key = match[1].toLowerCase();
    if (key.startsWith("data-") && match[3]) attributes[key as `data-${string}`] = match[3];
  }
  return attributes;
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

export function VibixPlayer({ iframeUrl, embedCode, title }: VibixPlayerProps) {
  const normalizedIframeUrl = useMemo(() => normalizeIframeUrl(iframeUrl), [iframeUrl]);
  const attributes = useMemo(() => parseEmbedCode(embedCode), [embedCode]);
  const hasEmbedSource = Boolean(attributes["data-type"] && attributes["data-id"]);
  const [iframeFailed, setIframeFailed] = useState(false);
  const iframeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    console.log("[VibixPlayer] sources", { iframeUrl, embedCode, attrs: attributes });
    if (!hasEmbedSource) return;

    const initialize = () => {
      try {
        window.dispatchEvent(new Event("resize"));
        const rendexWindow = window as RendexWindow;
        rendexWindow.Rendex?.init?.();
        rendexWindow.rendex?.init?.();
      } catch (error) {
        console.warn("[VibixPlayer] SDK init failed", error);
      }
    };

    initialize();
    const retries = [500, 1_500, 3_000].map((delay) => window.setTimeout(initialize, delay));
    return () => retries.forEach((retry) => window.clearTimeout(retry));
  }, [iframeUrl, embedCode, attributes, hasEmbedSource]);

  useEffect(() => {
    setIframeFailed(false);
    if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
    if (hasEmbedSource || !normalizedIframeUrl) return;

    iframeTimeoutRef.current = window.setTimeout(() => setIframeFailed(true), 10_000);
    return () => {
      if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
    };
  }, [hasEmbedSource, normalizedIframeUrl]);

  if (hasEmbedSource) {
    return (
      <div className="aspect-video w-full bg-black">
        <ins
          key={`${attributes["data-type"]}-${attributes["data-id"]}`}
          {...attributes}
          className="block h-full min-h-[240px] w-full"
          data-design="1"
          data-poster="true"
          data-nopreload="true"
          data-height="520px"
          data-color1="#e50914"
          data-color2="#ffffff"
          data-color3="#b91c1c"
          data-color4="#e50914"
          data-color5="#000000"
        />
      </div>
    );
  }

  if (normalizedIframeUrl && !iframeFailed) {
    return (
      <iframe
        src={normalizedIframeUrl}
        className="aspect-video w-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="no-referrer-when-downgrade"
        title={title || "REDFILM player"}
        onLoad={() => {
          if (iframeTimeoutRef.current !== null) window.clearTimeout(iframeTimeoutRef.current);
        }}
        onError={() => setIframeFailed(true)}
      />
    );
  }

  return (
    <div className="poster-fallback relative flex aspect-video flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,.24),transparent_45%),linear-gradient(180deg,rgba(255,255,255,.04),transparent)]" />
      <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/10 bg-[#e50914] shadow-[0_0_52px_rgba(229,9,20,.42)]">
        <Play fill="white" color="white" size={28} />
      </div>
      <p className="relative z-10 mt-5 px-5 text-center text-white/70">Источник плеера временно недоступен</p>
    </div>
  );
}
