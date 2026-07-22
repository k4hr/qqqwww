"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { MovieCard } from "@/components/movie-card";
import { discoveryMoods, type DiscoveryMood, type DiscoveryMovie } from "@/lib/discovery/types";
import { trackEvent } from "@/lib/client-analytics";

type Props = {
  initialMood: DiscoveryMood;
  initialMovies: DiscoveryMovie[];
};

export function TodayPicker({ initialMood, initialMovies }: Props) {
  const [mood, setMood] = useState<DiscoveryMood>(initialMood);
  const [movies, setMovies] = useState(initialMovies);
  const [isPending, startTransition] = useTransition();

  function choose(nextMood: DiscoveryMood) {
    setMood(nextMood);
    trackEvent("discovery_submit", { query: nextMood, results: movies.length });
    startTransition(async () => {
      try {
        const response = await fetch(`/api/discovery/recommendations?mood=${encodeURIComponent(nextMood)}&limit=10`);
        if (!response.ok) return;
        const data = await response.json() as { movies?: DiscoveryMovie[] };
        setMovies(data.movies ?? []);
      } catch {
        // The server-rendered list remains visible if the optional refresh fails.
      }
    });
  }

  const activeDescription = discoveryMoods.find((item) => item.key === mood)?.description;

  return (
    <section className="mf-panel mt-8 overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[#e50914]/14 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(230px,320px)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-[#ff4d55]">
            <Sparkles size={14} /> Подбор
          </div>
          <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-black leading-tight tracking-[-.04em] text-white">Что посмотреть сегодня?</h2>
          <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">{activeDescription}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {discoveryMoods.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choose(item.key)}
                className={`mf-pill ${item.key === mood ? "active" : ""}`}
                aria-pressed={item.key === mood}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link href="/match" className="mf-btn mf-btn-primary mt-5">Открыть REDFILM Match</Link>
        </div>

        <div aria-busy={isPending} className={`movie-grid relative transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
          {movies.map((movie) => (
            <div key={movie.id} onClick={() => trackEvent("discovery_result_click", { movieId: movie.id, query: mood })}>
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
