"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { ArtworkPlaceholder, isGenericRedfilmArtwork } from "@/components/artwork-placeholder";
import { similarPath, watchPath } from "@/lib/seo-links";
import { trackWatchClick } from "@/lib/client-analytics";

export type HeroMovie = {
  id: string;
  slug: string;
  titleRu: string;
  description: string;
  year: number;
  quality: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  kpRating: number | null;
  imdbRating: number | null;
};

export function MovieHeroSlider({ movies }: { movies: HeroMovie[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const slideCount = movies.length;

  const showSlide = useCallback((index: number) => {
    if (!slideCount) return;
    setActiveIndex((index + slideCount) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const startTimer = window.setTimeout(() => {
      const interval = window.setInterval(() => setActiveIndex((current) => (current + 1) % slideCount), 7000);
      intervalRef.current = interval;
    }, 7000);
    return () => {
      window.clearTimeout(startTimer);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [paused, slideCount]);

  if (!slideCount) {
    return (
      <section className="hero-slider relative overflow-hidden bg-[#08090b]">
        <div className="hero-layout relative z-10 flex min-h-[430px] max-w-2xl flex-col justify-end p-6 sm:min-h-[500px] sm:p-12">
          <div className="rf-section-eyebrow">REDFILM</div>
          <h1 className="hero-title mt-3 text-[clamp(2rem,7vw,3.5rem)] font-semibold tracking-[-.045em] text-white">Фильмы, сериалы и истории на вечер</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#a0a1a8]">Выбирайте кино по настроению, жанру или рейтингу и продолжайте вечер с REDFILM.</p>
        </div>
      </section>
    );
  }

  const movie = movies[activeIndex];
  const hasBackdrop = !isGenericRedfilmArtwork(movie.backdropUrl);

  return (
    <section
      className="hero-slider relative overflow-hidden bg-[#08090b]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (Math.abs(delta) >= 45) showSlide(activeIndex + (delta < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Избранные фильмы"
    >
      {hasBackdrop ? (
        <Image
          key={movie.backdropUrl}
          src={movie.backdropUrl!}
          alt=""
          fill
          priority={activeIndex === 0}
          fetchPriority={activeIndex === 0 ? "high" : "auto"}
          loading={activeIndex === 0 ? "eager" : "lazy"}
          sizes="(max-width: 768px) 100vw, 1360px"
          quality={76}
          className="object-cover object-center opacity-[.9] transition-[opacity,transform] duration-700"
        />
      ) : <ArtworkPlaceholder title={movie.titleRu} compact />}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,8,.94)_0%,rgba(6,6,8,.68)_43%,rgba(6,6,8,.08)_84%),linear-gradient(0deg,rgba(7,7,8,.92)_0%,transparent_44%)] max-md:bg-[linear-gradient(0deg,rgba(6,6,8,.97)_5%,rgba(6,6,8,.61)_62%,rgba(6,6,8,.12)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,43,66,.5),transparent)]" />

      <div className="hero-layout relative z-10 flex min-h-[460px] items-end px-5 pb-8 pt-20 sm:min-h-[500px] sm:px-9 sm:pb-10 lg:min-h-[520px] lg:px-12">
        <div className="hero-content max-w-[660px]">
          <h1 className="hero-title break-words text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-.045em] text-white">{movie.titleRu}</h1>
          <div className="hero-meta mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-[#b5b6bd]">
            <span>{movie.year}</span>
            {movie.quality ? <><span className="text-white/25">•</span><span>{movie.quality}</span></> : null}
            {movie.kpRating != null ? <><span className="text-white/25">•</span><span><b className="font-semibold text-[#d5b36a]">КП</b> {movie.kpRating.toFixed(1)}</span></> : null}
            {movie.imdbRating != null ? <><span className="text-white/25">•</span><span><b className="font-semibold text-[#d5b36a]">IMDb</b> {movie.imdbRating.toFixed(1)}</span></> : null}
          </div>
          <p className="hero-description line-clamp-2 mt-4 max-w-2xl text-[15px] leading-7 text-[#c3c4ca] sm:text-base">{movie.description}</p>
          <div className="hero-actions mt-6 flex flex-wrap gap-3">
            <Link href={watchPath(movie)} onClick={() => trackWatchClick(movie.id)} className="hero-primary-action mf-btn mf-btn-primary gap-2"><Play size={16} fill="currentColor" /> Смотреть</Link>
            <Link href={similarPath(movie)} className="mf-btn">Похожие</Link>
          </div>
        </div>

      </div>

      {slideCount > 1 ? (
        <>
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 sm:bottom-5 sm:right-5">
            <div className="mr-1 hidden gap-1.5 sm:flex" aria-hidden>
              {movies.map((item, index) => <span key={item.id} className={`h-1 rounded-full transition-all ${index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/35"}`} />)}
            </div>
            <button type="button" onClick={() => showSlide(activeIndex - 1)} aria-label="Предыдущий фильм" className="hero-arrow hero-arrow-prev flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:border-white/25 hover:bg-black/70"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => showSlide(activeIndex + 1)} aria-label="Следующий фильм" className="hero-arrow hero-arrow-next flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:border-white/25 hover:bg-black/70"><ChevronRight size={18} /></button>
          </div>
        </>
      ) : null}
    </section>
  );
}
