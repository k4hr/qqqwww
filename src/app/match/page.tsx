import type { Metadata } from "next";
import { MatchDeckClient } from "@/components/match/match-deck-client";
import { getMatchCandidates } from "@/lib/discovery/recommendations";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "REDFILM Match — быстрый выбор фильма",
  description: "Интерактивный подбор фильмов и сериалов REDFILM по карточкам: лайк, пропуск, избранное и быстрый переход к просмотру.",
  alternates: { canonical: "/match" },
};

export default async function MatchPage() {
  const movies = await getMatchCandidates({ limit: 24 });

  return (
    <div className="container py-6 sm:py-8">
      <section className="mb-8 border-b border-white/[.055] pb-7 sm:pb-9">
        <div className="max-w-3xl">
          <div className="rf-section-eyebrow mb-3">REDFILM Match</div>
          <h1 className="rf-page-title">Выберите кино по настроению</h1>
          <p className="rf-copy mt-4 max-w-2xl">
            Отмечайте, что нравится, — REDFILM будет точнее подбирать следующий вариант.
          </p>
        </div>
      </section>
      <div id="match-deck">
        <MatchDeckClient movies={movies} />
      </div>
    </div>
  );
}
