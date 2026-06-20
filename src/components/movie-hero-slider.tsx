"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Sparkles } from "lucide-react";
import { similarPath, watchPath } from "@/lib/seo-links";

export type HeroMovie = {
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
  const slideCount = movies.length;

  const showSlide = useCallback((index: number) => {
    if (!slideCount) return;
    setActiveIndex((index + slideCount) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slideCount), 5000);
    return () => window.clearInterval(timer);
  }, [paused, slideCount]);

  if (!slideCount) {
    return (
      <section className="hero-slider poster-fallback relative overflow-hidden rounded-[30px] border border-white/10">
        <div className="absolute inset-0 bg-[url('/redfilm-hero.png')] bg-cover bg-center opacity-45" />
        <div className="background-overlay absolute inset-0" />
        <div className="hero-layout relative z-10 flex min-h-[460px] max-w-2xl flex-col justify-end p-5 sm:min-h-[560px] sm:p-12">
          <h1 className="hero-title text-[clamp(2rem,10vw,3.75rem)] font-black tracking-[-.045em] text-white">REDFILM</h1>
          <p className="mt-4 text-lg text-[#c7c7ce]">Каталог обновляется. Фильмы скоро появятся.</p>
        </div>
      </section>
    );
  }

  const movie = movies[activeIndex];
  const backgroundUrl = movie.backdropUrl || movie.posterUrl || "/redfilm-hero.png";

  return (
    <section
      className="hero-slider relative overflow-hidden rounded-[30px] border border-white/10 bg-[#08080c]"
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
      {movies.map((item, index) => {
        const imageUrl = item.backdropUrl || item.posterUrl || "/redfilm-hero.png";
        return (
          <div
            key={item.slug}
            className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${index === activeIndex ? "scale-100 opacity-65" : "pointer-events-none scale-105 opacity-0"}`}
            style={{ backgroundImage: `url(${imageUrl})` }}
            aria-hidden={index !== activeIndex}
          />
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(229,9,20,.3),transparent_34%),linear-gradient(90deg,rgba(4,4,6,.98)_0%,rgba(4,4,6,.84)_43%,rgba(4,4,6,.2)_100%)] max-md:bg-[linear-gradient(0deg,rgba(4,4,6,.98)_4%,rgba(4,4,6,.78)_64%,rgba(4,4,6,.24)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,transparent_36%)]" />

      <div className="hero-layout relative z-10 grid min-h-[500px] items-end gap-7 p-5 sm:min-h-[560px] sm:p-8 md:min-h-[620px] md:grid-cols-[minmax(0,1fr)_240px] md:items-center lg:grid-cols-[minmax(0,1fr)_300px] lg:p-14">
        <div className="hero-content max-w-3xl pb-14 md:pb-0">
          <div className="hero-kicker mb-5 inline-flex items-center gap-2 rounded-full border border-[#e50914]/45 bg-black/40 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-[#ff4d55] backdrop-blur-md">
            <Sparkles size={14} /> В подборке REDFILM
          </div>
          <h1 className="hero-title break-words text-[clamp(2rem,9vw,4.5rem)] font-black leading-[.98] tracking-[-.05em] text-white drop-shadow-2xl">{movie.titleRu}</h1>
          <div className="hero-meta mt-5 flex flex-wrap items-center gap-2.5 text-sm font-bold">
            <span className="mf-badge">{movie.quality || "HD"}</span>
            <span className="mf-pill min-h-[28px] px-3">{movie.year}</span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-kp">КП</b> {movie.kpRating?.toFixed(1) ?? "—"}</span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-imdb">IMDb</b> {movie.imdbRating?.toFixed(1) ?? "—"}</span>
          </div>
          <p className="hero-description line-clamp-3 mt-5 max-w-2xl text-base leading-relaxed text-[#d0d0d6] sm:text-lg">{movie.description}</p>
          <div className="hero-actions mt-7 flex flex-wrap gap-3">
            <Link href={watchPath(movie)} className="hero-primary-action mf-btn mf-btn-primary gap-2"><Play size={16} fill="currentColor" /> Смотреть</Link>
            <div className="hero-secondary-actions contents">
              <Link href={similarPath(movie)} className="mf-btn">Похожие</Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[285px] md:block">
          <div className="absolute -inset-8 rounded-full bg-[#e50914]/20 blur-3xl" />
          <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-[26px] border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,.65)]">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="300px" unoptimized priority /> : <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundUrl})` }} />}
          </div>
        </div>
      </div>

      {slideCount > 1 ? (
        <>
          <button type="button" onClick={() => showSlide(activeIndex - 1)} aria-label="Предыдущий фильм" className="hero-arrow hero-arrow-prev absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:border-[#e50914]/70 hover:bg-[#e50914] max-sm:top-auto max-sm:bottom-5 max-sm:left-5 max-sm:translate-y-0"><ChevronLeft /></button>
          <button type="button" onClick={() => showSlide(activeIndex + 1)} aria-label="Следующий фильм" className="hero-arrow hero-arrow-next absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:border-[#e50914]/70 hover:bg-[#e50914] max-sm:top-auto max-sm:bottom-5 max-sm:translate-y-0"><ChevronRight /></button>
        </>
      ) : null}
    </section>
  );
}
