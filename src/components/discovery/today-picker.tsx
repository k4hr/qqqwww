"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { MovieCard } from "@/components/movie-card";
import { trackEvent } from "@/lib/client-analytics";
import {
  discoveryMoodOptions,
  discoveryMoods,
  discoveryPeriodOptions,
  discoveryRuntimeOptions,
  discoveryTypeOptions,
  type DiscoveryFilters,
  type DiscoveryMood,
  type DiscoveryMovie,
} from "@/lib/discovery/types";
import {
  activeTodayFilterLabels,
  applyTodayPreset,
  createTodayPickerState,
  resetTodayPickerState,
  toDiscoveryFilters,
  updateTodayPickerFilter,
  type TodayPickerState,
} from "@/lib/discovery/today-picker-state";

type Props = {
  initialMood: DiscoveryMood;
  initialMovies: DiscoveryMovie[];
};

export function TodayPicker({ initialMood, initialMovies }: Props) {
  const [pickerState, setPickerState] = useState<TodayPickerState>(() => createTodayPickerState(initialMood));
  const filters = toDiscoveryFilters(pickerState);
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
    const nextState = applyTodayPreset(pickerState, nextMood);
    const nextFilters = toDiscoveryFilters(nextState);
    setPickerState(nextState);
    requestMovies(nextFilters);
  }

  function updateFilter<Key extends keyof DiscoveryFilters>(key: Key, value: DiscoveryFilters[Key]) {
    setPickerState((current) => updateTodayPickerFilter(current, key, value));
  }

  function resetFilters() {
    const nextState = resetTodayPickerState();
    setPickerState(nextState);
    requestMovies(toDiscoveryFilters(nextState));
  }

  const activeDescription = discoveryMoods.find((item) => item.key === filters.mood)?.description
    ?? "Подбор учитывает тип, настроение, длительность и период.";

  return (
    <section className="rf-section rf-today-picker">
      <div className="max-w-3xl">
        <div className="rf-section-eyebrow inline-flex items-center gap-2"><Sparkles size={13} /> Подбор на вечер</div>
        <h2 className="rf-section-title mt-2">Что посмотреть сегодня?</h2>
        <p className="mt-2 text-sm leading-6 text-[#8f9098]">Выберите настроение — остальное подберём мы. {activeDescription}</p>
      </div>

      <div className="rf-today-moods mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {discoveryMoods.map((item) => (
          <button key={item.key} type="button" onClick={() => choosePreset(item.key)} className={`rf-filter ${item.key === filters.mood ? "rf-filter-active" : ""}`} aria-pressed={item.key === filters.mood}>{item.label}</button>
        ))}
      </div>

      <details className="rf-today-details group mt-2">
        <summary className="rf-today-summary inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#a0a1a8] transition hover:text-white">
          Настроить подбор <span aria-hidden className="transition group-open:rotate-45">+</span>
        </summary>
        <form className="rf-today-settings mt-2 grid gap-4 border-t border-white/[.07] pt-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); requestMovies(filters); }}>
          <label className="text-xs font-medium text-[#8f9098]">Тип
            <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as DiscoveryFilters["type"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryTypeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#8f9098]">Настроение
            <select value={filters.mood} onChange={(event) => updateFilter("mood", event.target.value as DiscoveryFilters["mood"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryMoods.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              {discoveryMoodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#8f9098]">Длительность
            <select value={filters.runtime} onChange={(event) => updateFilter("runtime", event.target.value as DiscoveryFilters["runtime"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryRuntimeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#8f9098]">Период
            <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as DiscoveryFilters["period"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
            <Toggle label="Высокий рейтинг" checked={Boolean(filters.highRating)} onChange={(checked) => updateFilter("highRating", checked)} />
            <Toggle label="Популярное" checked={Boolean(filters.popular)} onChange={(checked) => updateFilter("popular", checked)} />
            <Toggle label="Только новинки" checked={Boolean(filters.onlyNew)} onChange={(checked) => updateFilter("onlyNew", checked)} />
            <Toggle label="Случайный хороший" checked={Boolean(filters.randomGood)} onChange={(checked) => updateFilter("randomGood", checked)} />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={isPending} className="mf-btn mf-btn-primary disabled:opacity-60">{isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />} Подобрать</button>
            <button type="button" onClick={resetFilters} disabled={isPending} className="mf-btn gap-2 disabled:opacity-50"><RotateCcw size={15} /> Сбросить</button>
          </div>
        </form>
      </details>

      {activeTodayFilterLabels(pickerState).length ? (
        <div className="rf-today-active mt-3 text-xs leading-5 text-[#74757d]" aria-label="Активные фильтры">
          Активно: {activeTodayFilterLabels(pickerState).join(" · ")}
        </div>
      ) : null}
      {error ? <p role="status" className="mt-3 text-sm leading-6 text-[#e88a92]">{error}</p> : null}

      <div aria-busy={isPending} className={`movie-grid home-movie-strip mt-7 transition-opacity ${isPending ? "opacity-55" : "opacity-100"}`}>
        {movies.map((movie) => (
          <div key={movie.id} onClick={() => trackEvent("discovery_result_click", { movieId: movie.id, query: filters.mood })}>
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
      {!movies.length && !isPending ? <div className="mt-6 flex min-h-36 items-center justify-center rounded-[14px] border border-dashed border-white/10 p-6 text-center text-[#8f9098]">По этим параметрам ничего не найдено. Попробуйте расширить фильтры.</div> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => requestMovies(filters, true)} disabled={isPending || !movies.length} className="mf-btn gap-2 disabled:opacity-50"><RefreshCw size={16} /> Ещё варианты</button>
        <Link href="/match" className="rf-section-link px-2">Открыть ИИ-подбор →</Link>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`rf-today-toggle flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition ${checked ? "border-[#e31b32]/35 bg-[#e31b32]/10 text-white" : "border-white/[.07] bg-transparent text-[#a0a1a8] hover:border-white/[.14] hover:text-white"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${checked ? "bg-[#e31b32]" : "bg-white/20"}`} />{label}</span>
    </label>
  );
}
