"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Artwork = {
  id: string;
  type: "BACKDROP" | "POSTER" | "LOGO";
  url: string;
  width: number | null;
  height: number | null;
  language: string | null;
};

type MediaItem = {
  id: string;
  kind: "image" | "video";
  tab: "popular" | "videos" | "backdrops" | "posters";
  title: string;
  url: string;
  thumbUrl: string;
  width?: number | null;
  height?: number | null;
};

type Props = {
  title: string;
  trailerUrl?: string | null;
  artworks: Artwork[];
};

const tabs = [
  { key: "popular", label: "Популярное" },
  { key: "videos", label: "Видеоролики" },
  { key: "backdrops", label: "Задники" },
  { key: "posters", label: "Постеры" },
] as const;

function youtubeThumb(url: string) {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match?.[1] ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export function WatchMediaGallery({ title, trailerUrl, artworks }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("popular");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const items = useMemo<MediaItem[]>(() => {
    const videos: MediaItem[] = trailerUrl ? [{
      id: "trailer",
      kind: "video",
      tab: "videos",
      title: `Трейлер ${title}`,
      url: trailerUrl,
      thumbUrl: youtubeThumb(trailerUrl) ?? "/redfilm-hero.webp",
    }] : [];
    const backdrops = artworks.filter((item) => item.type === "BACKDROP").slice(0, 12).map((item, index) => ({
      id: item.id,
      kind: "image" as const,
      tab: "backdrops" as const,
      title: `Задник ${index + 1}: ${title}`,
      url: item.url,
      thumbUrl: item.url,
      width: item.width,
      height: item.height,
    }));
    const posters = artworks.filter((item) => item.type === "POSTER").slice(0, 12).map((item, index) => ({
      id: item.id,
      kind: "image" as const,
      tab: "posters" as const,
      title: `Постер ${index + 1}: ${title}`,
      url: item.url,
      thumbUrl: item.url,
      width: item.width,
      height: item.height,
    }));
    return [
      ...videos.map((item) => ({ ...item, tab: "popular" as const })),
      ...backdrops.slice(0, 5).map((item) => ({ ...item, tab: "popular" as const })),
      ...posters.slice(0, 3).map((item) => ({ ...item, tab: "popular" as const })),
      ...videos,
      ...backdrops,
      ...posters,
    ];
  }, [artworks, title, trailerUrl]);

  const visibleItems = items.filter((item) => item.tab === activeTab);
  const lightboxItem = lightboxIndex !== null ? visibleItems[lightboxIndex] : null;
  const safeLightboxIndex = lightboxIndex ?? 0;

  useEffect(() => {
    if (!lightboxItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowRight") setLightboxIndex((index) => index === null ? index : (index + 1) % visibleItems.length);
      if (event.key === "ArrowLeft") setLightboxIndex((index) => index === null ? index : (index - 1 + visibleItems.length) % visibleItems.length);
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [lightboxItem, visibleItems.length]);

  if (!items.length) return null;

  return (
    <section className="mf-panel mt-8 overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[.16em] text-[#e50914]">Медиа</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-white">Материалы к фильму</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto rounded-full border border-white/[.07] bg-black/20 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`mf-pill ${activeTab === tab.key ? "active" : ""}`} aria-pressed={activeTab === tab.key}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="media-scroll-grid">
        {visibleItems.slice(0, activeTab === "popular" ? 9 : 12).map((item, index) => (
          <button
            key={`${item.tab}-${item.id}`}
            type="button"
            ref={(node) => {
              if (index === lightboxIndex && node) restoreFocusRef.current = node;
            }}
            onClick={(event) => {
              restoreFocusRef.current = event.currentTarget;
              setLightboxIndex(index);
            }}
            className={`poster-fallback relative snap-start overflow-hidden rounded-2xl border border-white/10 text-left transition hover:border-[#e50914]/60 ${item.tab === "posters" ? "aspect-[2/3]" : "aspect-video"}`}
            aria-label={`Открыть ${item.title}`}
          >
            <Image src={item.thumbUrl} alt={item.title} fill loading="lazy" sizes="(max-width: 640px) 72vw, (max-width: 1024px) 34vw, 260px" className="object-cover" />
            {item.kind === "video" ? <span className="absolute left-3 top-3 rounded-full bg-[#e50914] px-3 py-1 text-xs font-black text-white">Видео</span> : null}
          </button>
        ))}
      </div>

      {lightboxItem ? (
        <div role="dialog" aria-modal="true" aria-label={lightboxItem.title} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/88 p-3 backdrop-blur-xl" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxIndex(null); }}>
          <button ref={closeButtonRef} type="button" onClick={() => setLightboxIndex(null)} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[.08] text-white" aria-label="Закрыть галерею">
            <X />
          </button>
          {visibleItems.length > 1 ? (
            <>
              <button type="button" onClick={() => setLightboxIndex((safeLightboxIndex - 1 + visibleItems.length) % visibleItems.length)} className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[.08] text-white" aria-label="Предыдущее изображение"><ChevronLeft /></button>
              <button type="button" onClick={() => setLightboxIndex((safeLightboxIndex + 1) % visibleItems.length)} className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[.08] text-white" aria-label="Следующее изображение"><ChevronRight /></button>
            </>
          ) : null}
          {lightboxItem.kind === "video" ? (
            <a href={lightboxItem.url} target="_blank" rel="noreferrer" className="mf-btn mf-btn-primary">Открыть трейлер</a>
          ) : (
            <div className="relative h-[min(82svh,820px)] w-[min(94vw,1280px)]">
              <Image src={lightboxItem.url} alt={lightboxItem.title} fill sizes="94vw" className="object-contain" />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
