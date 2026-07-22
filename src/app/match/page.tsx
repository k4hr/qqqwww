import type { Metadata } from "next";
import Link from "next/link";
import { MatchDeckClient } from "@/components/match/match-deck-client";
import { PosterMosaic } from "@/components/poster-mosaic";
import { getMatchCandidates } from "@/lib/discovery/recommendations";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "REDFILM Match — быстрый выбор фильма",
  description: "Интерактивный подбор фильмов и сериалов REDFILM по карточкам: лайк, пропуск, избранное и быстрый переход к просмотру.",
  alternates: { canonical: "/match" },
};

export default async function MatchPage() {
  const movies = await getMatchCandidates({ limit: 42 });

  return (
    <div className="container py-5 sm:py-7">
      <PosterMosaic movies={movies} />
      <section className="glass-panel section-glow mb-6 overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="max-w-4xl">
          <div className="mb-3 text-xs font-black uppercase tracking-[.18em] text-[#e50914]">REDFILM Match</div>
          <h1 className="text-[clamp(2rem,8vw,4.5rem)] font-black leading-none tracking-[-.055em] text-white">Выберите кино по настроению</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#c9c9d1]">
            Листайте карточки, сохраняйте понравившееся и переходите к просмотру. Все варианты берутся из текущего каталога REDFILM и имеют доступный источник воспроизведения.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/films" className="mf-btn">Фильмы</Link>
            <Link href="/series" className="mf-btn">Сериалы</Link>
            <Link href="/collections" className="mf-btn">Подборки</Link>
          </div>
        </div>
      </section>
      <div id="match-deck">
        <MatchDeckClient movies={movies} />
      </div>
    </div>
  );
}
