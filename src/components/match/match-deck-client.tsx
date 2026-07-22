"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw, SkipForward, Star, ThumbsDown, ThumbsUp, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieCard } from "@/components/movie-card";
import { navigateWithProgress } from "@/components/navigation-progress-client";
import { toggleFavorite } from "@/lib/client-watch-history";
import { trackEvent } from "@/lib/client-analytics";
import {
  applyMatchDecision,
  cloneMatchPreferences,
  readMatchHistory,
  readMatchPreferences,
  resetMatchStorage,
  writeMatchState,
} from "@/lib/discovery/match-storage";
import {
  defaultDiscoveryFilters,
  discoveryMoodOptions,
  discoveryPeriodOptions,
  discoveryRuntimeOptions,
  discoveryTypeOptions,
  emptyMatchPreferences,
  type DiscoveryFilters,
  type DiscoveryMovie,
  type MatchHistoryEvent,
  type MatchPreferences,
} from "@/lib/discovery/types";
import { watchPath } from "@/lib/seo-links";

type MatchState = "READY" | "LOADING_NEXT" | "EMPTY" | "FINISHED" | "ERROR";
type MatchAction = MatchHistoryEvent["action"];

type MatchUndoEntry = {
  movie: DiscoveryMovie;
  action: MatchAction;
  previousIndex: number;
  previousPreferences: MatchPreferences;
  previousHistory: MatchHistoryEvent[];
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastAt: number;
  axis: "horizontal" | "vertical" | null;
} | null;

const SWIPE_DISTANCE = 92;
const SWIPE_VELOCITY = 0.55;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

function seenIds(preferences: MatchPreferences, history: MatchHistoryEvent[]) {
  return Array.from(new Set([
    ...preferences.liked,
    ...preferences.disliked,
    ...preferences.skipped,
    ...history.map((event) => event.movieId),
  ])).slice(-250);
}

export function MatchDeckClient({ movies }: { movies: DiscoveryMovie[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<DiscoveryMovie[]>(movies);
  const [preferences, setPreferences] = useState<MatchPreferences>(() => emptyMatchPreferences());
  const [history, setHistory] = useState<MatchHistoryEvent[]>([]);
  const [filters, setFilters] = useState<DiscoveryFilters>({ ...defaultDiscoveryFilters });
  const [matchState, setMatchState] = useState<MatchState>(movies.length ? "READY" : "EMPTY");
  const [hydrated, setHydrated] = useState(false);
  const [undoEntry, setUndoEntry] = useState<MatchUndoEntry | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const requestIdRef = useRef(0);
  const actionLockRef = useRef(false);
  const dragRef = useRef<DragSession>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const activeMovie = queue[0] ?? null;
  const nextMovies = queue.slice(1, 7);

  useEffect(() => {
    const storedPreferences = readMatchPreferences();
    const storedHistory = readMatchHistory();
    const excluded = new Set(seenIds(storedPreferences, storedHistory));
    const initialQueue = movies.filter((movie) => !excluded.has(movie.id));
    setPreferences(storedPreferences);
    setHistory(storedHistory);
    setQueue(initialQueue);
    setMatchState(initialQueue.length ? "READY" : movies.length ? "LOADING_NEXT" : "EMPTY");
    setHydrated(true);
    if (movies.length && !initialQueue.length) void loadNextBatch({ ...defaultDiscoveryFilters }, storedPreferences, storedHistory, []);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
    // Initial candidates are immutable for the lifetime of the client island.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNextBatch(
    nextFilters = filters,
    currentPreferences = preferences,
    currentHistory = history,
    additionalExcluded = queue.map((movie) => movie.id),
  ) {
    const requestId = ++requestIdRef.current;
    setMatchState("LOADING_NEXT");
    try {
      const response = await fetch("/api/discovery/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          excludeIds: [...seenIds(currentPreferences, currentHistory), ...additionalExcluded].slice(-250),
          likedIds: currentPreferences.liked.slice(-80),
          dislikedIds: currentPreferences.disliked.slice(-120),
          filters: nextFilters,
          preferences: {
            genreWeights: currentPreferences.genreWeights,
            typeWeights: currentPreferences.typeWeights,
            decadeWeights: currentPreferences.decadeWeights,
            countryWeights: currentPreferences.countryWeights,
            runtimeBuckets: currentPreferences.runtimeBuckets,
            runtimePreference: nextFilters.runtime,
          },
          seed: `${Date.now()}-${currentHistory.length}`,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { movies?: DiscoveryMovie[] };
      if (requestId !== requestIdRef.current) return;
      const excluded = new Set(seenIds(currentPreferences, currentHistory));
      const nextQueue = (payload.movies ?? []).filter((movie) => !excluded.has(movie.id));
      setQueue(nextQueue);
      setUndoEntry(null);
      setMatchState(nextQueue.length ? "READY" : "FINISHED");
    } catch {
      if (requestId === requestIdRef.current) setMatchState("ERROR");
    }
  }

  function resetDrag() {
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
  }

  function commitDecision(action: MatchAction) {
    if (!activeMovie || actionLockRef.current || matchState !== "READY") return;
    actionLockRef.current = true;
    const movie = activeMovie;
    const previousPreferences = cloneMatchPreferences(preferences);
    const previousHistory = history.map((event) => ({ ...event }));
    const nextPreferences = applyMatchDecision(preferences, movie, action);
    const nextHistory = [...history, { movieId: movie.id, action, createdAt: Date.now() }].slice(-220);
    const remainingQueue = queue.slice(1);
    setPreferences(nextPreferences);
    setHistory(nextHistory);
    setUndoEntry({ movie, action, previousIndex: 0, previousPreferences, previousHistory });
    writeMatchState(nextPreferences, nextHistory);
    trackEvent(action === "LIKE" ? "match_like" : action === "DISLIKE" ? "match_dislike" : "match_skip", { movieId: movie.id });
    setDragging(false);
    setDragX(action === "DISLIKE" ? -Math.max(window.innerWidth, 720) : Math.max(window.innerWidth, 720));

    window.setTimeout(() => {
      setQueue(remainingQueue);
      setDragX(0);
      actionLockRef.current = false;
      if (remainingQueue.length) setMatchState("READY");
      else void loadNextBatch(filters, nextPreferences, nextHistory, []);
    }, reducedMotion ? 60 : 190);
  }

  function undoLast() {
    if (!undoEntry || actionLockRef.current) return;
    requestIdRef.current += 1;
    const restoredQueue = queue.some((movie) => movie.id === undoEntry.movie.id) ? queue : [undoEntry.movie, ...queue];
    setQueue(restoredQueue);
    setPreferences(undoEntry.previousPreferences);
    setHistory(undoEntry.previousHistory);
    writeMatchState(undoEntry.previousPreferences, undoEntry.previousHistory);
    setUndoEntry(null);
    setMatchState("READY");
    resetDrag();
    trackEvent("match_undo", { movieId: undoEntry.movie.id });
  }

  function hardReset() {
    requestIdRef.current += 1;
    const nextPreferences = resetMatchStorage();
    setPreferences(nextPreferences);
    setHistory([]);
    setQueue([]);
    setUndoEntry(null);
    setMatchState("LOADING_NEXT");
    resetDrag();
    trackEvent("match_reset");
    void loadNextBatch(filters, nextPreferences, [], []);
  }

  function updateFilter<Key extends keyof DiscoveryFilters>(key: Key, value: DiscoveryFilters[Key]) {
    const nextFilters = { ...filters, [key]: value };
    requestIdRef.current += 1;
    setFilters(nextFilters);
    setQueue([]);
    setUndoEntry(null);
    resetDrag();
    void loadNextBatch(nextFilters, preferences, history, []);
  }

  function openActiveMovie() {
    if (!activeMovie) return;
    trackEvent("match_watch", { movieId: activeMovie.id });
    navigateWithProgress(router, watchPath(activeMovie));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        if (dragRef.current || dragX) {
          event.preventDefault();
          resetDrag();
        }
        return;
      }
      if (!activeMovie || matchState !== "READY") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        commitDecision("DISLIKE");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        commitDecision("LIKE");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        commitDecision("SKIP");
      } else if (event.key === "Enter") {
        event.preventDefault();
        openActiveMovie();
      } else if (event.key === "Backspace" && undoEntry) {
        event.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!activeMovie || matchState !== "READY" || actionLockRef.current || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastAt: performance.now(),
      axis: null,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
    }
    drag.lastX = event.clientX;
    drag.lastAt = performance.now();
    if (drag.axis !== "horizontal") return;
    event.preventDefault();
    setDragX(dx);
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const elapsed = Math.max(1, performance.now() - drag.lastAt);
    const velocity = Math.abs(event.clientX - drag.lastX) / elapsed;
    const horizontal = drag.axis === "horizontal";
    dragRef.current = null;
    setDragging(false);
    if (!cancelled && horizontal && (Math.abs(dx) >= SWIPE_DISTANCE || (Math.abs(dx) >= 42 && velocity >= SWIPE_VELOCITY))) {
      commitDecision(dx < 0 ? "DISLIKE" : "LIKE");
      return;
    }
    setDragX(0);
  }

  const cardStyle = useMemo(() => ({
    transform: `translate3d(${dragX}px,0,0) rotate(${reducedMotion ? 0 : Math.max(-7, Math.min(7, dragX / 28))}deg)`,
    transition: dragging ? "none" : reducedMotion ? "opacity 80ms ease" : "transform 190ms cubic-bezier(.2,.8,.2,1)",
    touchAction: "pan-y" as const,
  }), [dragX, dragging, reducedMotion]);

  return (
    <section aria-busy={matchState === "LOADING_NEXT"} className="grid gap-5">
      <div ref={filtersRef} className="mf-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Настройте подбор</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Фильтры применяются на сервере, просмотренные варианты не повторяются.</p>
          </div>
          <button type="button" onClick={undoLast} disabled={!undoEntry || actionLockRef.current} className="mf-btn min-h-11 gap-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Отменить последнее решение">
            <Undo2 size={17} /> Отменить
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-bold text-[#d4d4d8]">Тип
            <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as DiscoveryFilters["type"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryTypeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#d4d4d8]">Настроение
            <select value={filters.mood} onChange={(event) => updateFilter("mood", event.target.value as DiscoveryFilters["mood"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryMoodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#d4d4d8]">Длительность
            <select value={filters.runtime} onChange={(event) => updateFilter("runtime", event.target.value as DiscoveryFilters["runtime"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryRuntimeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#d4d4d8]">Период
            <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as DiscoveryFilters["period"])} className="mf-input mt-2 min-h-11 w-full">
              {discoveryPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="mf-panel min-h-[560px] overflow-hidden p-0" aria-live="polite">
          {activeMovie && matchState !== "ERROR" ? (
            <div
              className="relative min-h-[560px] select-none overflow-hidden"
              style={cardStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => finishPointer(event)}
              onPointerCancel={(event) => finishPointer(event, true)}
              aria-label={`${activeMovie.titleRu}. Свайп влево — не сейчас, вправо — нравится.`}
            >
              <Image src={activeMovie.backdropUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 760px" className="object-cover opacity-55" priority />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(229,9,20,.20),transparent_34%),linear-gradient(90deg,rgba(5,5,8,.99),rgba(5,5,8,.72))]" />
              <div className="relative z-10 grid min-h-[560px] gap-6 p-5 sm:p-8 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
                <div className="poster-fallback relative mx-auto aspect-[2/3] w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,.62)]">
                  {activeMovie.posterUrl ? <Image src={activeMovie.posterUrl} alt={activeMovie.titleRu} fill sizes="260px" className="object-cover" /> : null}
                </div>
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-[#ff4d55]"><Star size={14} /> REDFILM Match</div>
                  <h2 className="text-[clamp(2rem,7vw,4rem)] font-black leading-none tracking-[-.055em] text-white">{activeMovie.titleRu}</h2>
                  <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
                    <span className="mf-badge">{activeMovie.quality || "HD"}</span>
                    <span className="mf-pill min-h-[28px] px-3">{activeMovie.year}</span>
                    {activeMovie.duration ? <span className="mf-pill min-h-[28px] px-3">{activeMovie.duration} мин.</span> : null}
                    <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-kp">КП</b> {activeMovie.kpRating?.toFixed(1) ?? "—"}</span>
                    <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5"><b className="rating-imdb">IMDb</b> {activeMovie.imdbRating?.toFixed(1) ?? "—"}</span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#ff8b91]">{activeMovie.explanation}</p>
                  <p className="mt-3 line-clamp-3 max-w-2xl text-base leading-7 text-[#d4d4d8]">{activeMovie.description}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button type="button" onClick={() => commitDecision("DISLIKE")} className="mf-btn min-h-11 gap-2" aria-label="Не нравится, показать следующий"><ThumbsDown size={17} /> Не сейчас</button>
                    <button type="button" onClick={() => commitDecision("LIKE")} className="mf-btn min-h-11 gap-2" aria-label="Нравится"><ThumbsUp size={17} /> Нравится</button>
                    <button type="button" onClick={() => commitDecision("SKIP")} className="mf-btn min-h-11 gap-2" aria-label="Нейтрально, следующий фильм"><SkipForward size={17} /> Следующий</button>
                    <button type="button" onClick={() => {
                      toggleFavorite({ id: activeMovie.id, slug: activeMovie.slug, title: activeMovie.titleRu, year: activeMovie.year, posterUrl: activeMovie.posterUrl, type: activeMovie.type, kpRating: activeMovie.kpRating, imdbRating: activeMovie.imdbRating });
                      trackEvent("match_favorite", { movieId: activeMovie.id });
                    }} className="mf-btn min-h-11">В избранное</button>
                    <button type="button" onClick={openActiveMovie} className="mf-btn mf-btn-primary min-h-11">Смотреть</button>
                  </div>
                  <p className="mt-5 text-xs leading-5 text-[#8b8b95]">Клавиши: ← не сейчас, → нравится, ↓ следующий, Enter смотреть, Backspace отменить.</p>
                </div>
              </div>
            </div>
          ) : null}

          {!activeMovie && matchState === "LOADING_NEXT" ? <StatePanel icon={<LoaderCircle className="animate-spin" />} title="Собираем следующую партию" text="Учитываем ваши решения, фильтры и разнообразие каталога." /> : null}
          {!activeMovie && matchState === "EMPTY" ? <StatePanel title="Пока нет подходящих вариантов" text="Измените фильтры или попробуйте повторить загрузку." actions={<><button type="button" onClick={() => void loadNextBatch(filters, preferences, history, [])} className="mf-btn mf-btn-primary">Повторить</button><Link href="/films" className="mf-btn">Перейти в каталог</Link></>} /> : null}
          {matchState === "ERROR" ? <StatePanel title="Не удалось загрузить подбор" text="Каталог продолжает работать. Можно повторить запрос без сброса решений." actions={<><button type="button" onClick={() => void loadNextBatch(filters, preferences, history, [])} className="mf-btn mf-btn-primary">Повторить</button><Link href="/films" className="mf-btn">Каталог</Link></>} /> : null}
          {!activeMovie && matchState === "FINISHED" ? <StatePanel title="Вы просмотрели все подходящие варианты" text="Можно начать заново, изменить фильтры или перейти в каталог." actions={<><button type="button" onClick={hardReset} className="mf-btn mf-btn-primary">Сбросить предпочтения</button><button type="button" onClick={() => filtersRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" })} className="mf-btn">Изменить фильтры</button><Link href="/films" className="mf-btn">Перейти в каталог</Link></>} /> : null}
        </div>

        <aside className="grid content-start gap-4">
          <div className="mf-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-black text-white">Очередь</h2><p className="mt-1 text-sm text-[#a1a1aa]">Осталось: {queue.length}</p></div>
              <button type="button" onClick={hardReset} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white" aria-label="Сбросить Match"><RotateCcw size={17} /></button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">Лайки мягко усиливают жанры и типы, дизлайки снижают их вес без жёсткой блокировки.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {nextMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        </aside>
      </div>
      {!hydrated ? <span className="sr-only">Загрузка сохранённых предпочтений</span> : null}
    </section>
  );
}

function StatePanel({ icon, title, text, actions }: { icon?: React.ReactNode; title: string; text: string; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-[560px] items-center justify-center p-6 text-center">
      <div className="max-w-xl">
        {icon ? <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e50914]/15 text-[#ff4d55]">{icon}</div> : null}
        <h2 className="text-3xl font-black text-white">{title}</h2>
        <p className="mt-3 leading-7 text-[#a1a1aa]">{text}</p>
        {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
