import Image from "next/image";
import Link from "next/link";
import type { DiscoveryMovie } from "@/lib/discovery/types";

type Props = {
  movies: DiscoveryMovie[];
};

export function PosterMosaic({ movies }: Props) {
  const posters = movies.filter((movie) => movie.posterUrl).slice(0, 56);
  if (!posters.length) return null;
  const rows = [posters.filter((_, index) => index % 4 === 0), posters.filter((_, index) => index % 4 === 1), posters.filter((_, index) => index % 4 === 2), posters.filter((_, index) => index % 4 === 3)];

  return (
    <section className="poster-mosaic relative -mx-4 mb-7 min-h-[520px] overflow-hidden rounded-[32px] border border-white/10 bg-[#050505] sm:mx-0 lg:min-h-[680px]">
      <div className="absolute inset-0 opacity-72">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className={`poster-mosaic-row poster-mosaic-row-${rowIndex + 1}`}>
            {[...row, ...row].map((movie, index) => (
              <div key={`${rowIndex}-${movie.id}-${index}`} className="poster-mosaic-cell poster-fallback relative overflow-hidden rounded-[18px] border border-white/10">
                {movie.posterUrl ? (
                  <Image
                    src={movie.posterUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 96px, 150px"
                    loading={rowIndex === 0 && index < 4 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(229,9,20,.32),transparent_28%),linear-gradient(90deg,#050505_0%,rgba(5,5,5,.62)_24%,rgba(5,5,5,.52)_72%,#050505_100%),linear-gradient(0deg,#050505_0%,rgba(5,5,5,.45)_35%,#050505_100%)]" />
      <div className="relative z-10 flex min-h-[520px] items-center justify-center px-4 text-center lg:min-h-[680px]">
        <div className="max-w-3xl">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#ff4d55]">REDFILM Match</div>
          <h1 className="text-[clamp(2.9rem,14vw,7.5rem)] font-black leading-[.86] tracking-[-.075em] text-white drop-shadow-2xl">Что посмотреть?</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#d8d8df] sm:text-lg">Быстрый подбор из реального каталога REDFILM: только опубликованные фильмы и сериалы с постером и рабочим источником воспроизведения.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#match-deck" className="mf-btn mf-btn-primary">Довериться REDFILM</a>
            <Link href="/search" className="mf-btn">Выбрать с фильтрами</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
