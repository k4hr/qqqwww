"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { MovieCard } from "@/components/movie-card";
import { trackEvent } from "@/lib/client-analytics";
import {
  defaultDiscoveryFilters,
  discoveryMoodOptions,
  discoveryMoods,
  discoveryPeriodOptions,
  discoveryRuntimeOptions,
  discoveryTypeOptions,
  type DiscoveryFilters,
  type DiscoveryMood,
  type DiscoveryMovie,
} from "@/lib/discovery/types";

type Props = {
  initialMood: DiscoveryMood;
  initialMovies: DiscoveryMovie[];
};

export function TodayPicker({ initialMood, initialMovies }: Props) {
  const [filters, setFilters] = useState<DiscoveryFilters>({ ...defaultDiscoveryFilters, mood: initialMood });
  const [movies, setMovies] = useState(initialMovies);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestMovies(nextFilters: DiscoveryFilters, excludeCurrent = false) {
    setError(null);
    trackEvent("discovery_submit", { query: JSON.stringify(nextFilters), results: movies.length });
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          mood: nextFilters.mood,
          type: nextFilters.type,
          runtime: nextFilters.runtime,
          period: nextFilters.period,
          highRating: String(Boolean(nextFilters.highRating)),
          popular: String(Boolean(nextFilters.popular)),
          onlyNew: String(Boolean(nextFilters.onlyNew)),
          randomGood: String(Boolean(nextFilters.randomGood)),
          limit: "10",
          seed: `${Date.now()}-${excludeCurrent ? "next" : "filter"}`,
        });
        if (excludeCurrent) movies.slice(0, 30).forEach((movie) => params.append("exclude", movie.id));
        const response = await fetch(`/api/discovery/recommendations?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { movies?: DiscoveryMovie[] };
        setMovies(data.movies ?? []);
      } catch {
        setError("Не удалось обновить подбор. Уже загруженные фильмы остаются доступны.");
      }
    });
  }

  function choosePreset(nextMood: DiscoveryMood) {
    const nextFilters = { ...filters, mood: nextMood, onlyNew: nextMood === "new" ? true : filters.onlyNew };
    setFilters(nextFilters);
    requestMovies(nextFilters);
  }

  function updateFilter<Key extends keyof DiscoveryFilters>(key: Key, value: DiscoveryFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const activeDescription = discoveryMoods.find((item) => item.key === filters.mood)?.description
    ?? "Подбор учитывает тип, настроение, длительность и период.";

  return (
    <section className="mf-panel mt-8 overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[#e50914]/14 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(250px,340px)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-[#ff4d55]"><Sparkles size={14} /> Подбор</div>
          <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-black leading-tight tracking-[-.04em] text-white">Что посмотреть сегодня?</h2>
          <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">{activeDescription}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {discoveryMoods.map((item) => (
              <button key={item.key} type="button" onClick={() => choosePreset(item.key)} className={`mf-pill ${item.key === filters.mood ? "active" : ""}`} aria-pressed={item.key === filters.mood}>{item.label}</button>
            ))}
          </div>

          <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); requestMovies(filters); }}>
            <label className="text-xs font-black uppercase tracking-[.12em] text-[#a1a1aa]">Тип
              <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as DiscoveryFilters["type"])} className="mf-input mt-1.5 min-h-11 w-full normal-case tracking-normal">
                {discoveryTypeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-[.12em] text-[#a1a1aa]">Настроение
              <select value={filters.mood} onChange={(event) => updateFilter("mood", event.target.value as DiscoveryFilters["mood"])} className="mf-input mt-1.5 min-h-11 w-full normal-case tracking-normal">
                {discoveryMoods.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                {discoveryMoodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-black uppercase tracking-[.12em] text-[#a1a1aa]">Длительность
                <select value={filters.runtime} onChange={(event) => updateFilter("runtime", event.target.value as DiscoveryFilters["runtime"])} className="mf-input mt-1.5 min-h-11 w-full normal-case tracking-normal">
                  {discoveryRuntimeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-[.12em] text-[#a1a1aa]">Период
                <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as DiscoveryFilters["period"])} className="mf-input mt-1.5 min-h-11 w-full normal-case tracking-normal">
                  {discoveryPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Toggle label="Высокий рейтинг" checked={Boolean(filters.highRating)} onChange={(checked) => updateFilter("highRating", checked)} />
              <Toggle label="Популярное" checked={Boolean(filters.popular)} onChange={(checked) => updateFilter("popular", checked)} />
              <Toggle label="Только новинки" checked={Boolean(filters.onlyNew)} onChange={(checked) => updateFilter("onlyNew", checked)} />
              <Toggle label="Случайный хороший" checked={Boolean(filters.randomGood)} onChange={(checked) => updateFilter("randomGood", checked)} />
            </div>
            <button type="submit" disabled={isPending} className="mf-btn mf-btn-primary min-h-11 disabled:opacity-60">{isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />} Подобрать</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => requestMovies(filters, true)} disabled={isPending || !movies.length} className="mf-btn min-h-11 gap-2 disabled:opacity-50"><RefreshCw size={16} /> Ещё варианты</button>
            <Link href="/match" className="mf-btn min-h-11">Открыть REDFILM Match</Link>
          </div>
          {error ? <p role="status" className="mt-3 text-sm leading-6 text-[#ff8b91]">{error}</p> : null}
        </div>

        <div className="min-h-[520px]">
          <div aria-busy={isPending} className={`movie-grid relative transition-opacity ${isPending ? "opacity-55" : "opacity-100"}`}>
            {movies.map((movie) => (
              <div key={movie.id} onClick={() => trackEvent("discovery_result_click", { movieId: movie.id, query: filters.mood })}>
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
          {!movies.length && !isPending ? <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-[#a1a1aa]">По этим параметрам ничего не найдено. Попробуйте расширить фильтры.</div> : null}
        </div>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-sm font-bold text-[#d4d4d8]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#e50914]" />
      <span>{label}</span>
    </label>
  );
}
